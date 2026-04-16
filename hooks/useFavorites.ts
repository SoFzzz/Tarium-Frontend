'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { canonicalTrackIdentity } from '@/lib/player/track-key';

export interface Favorite {
  id: string;
  user_id: string;
  track_id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  created_at: string;
}

interface UseFavorites {
  favorites: Favorite[];
  loading: boolean;
  error: string | null;
  spotifyFavIds: Set<string>;
  getFavorites: () => Promise<void>;
  addFavorite: (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>) => Promise<Favorite | null>;
  removeFavorite: (trackId: string) => Promise<void>;
  isFavorite: (trackId: string) => boolean;
}

type FavoritesStoreState = {
  favorites: Favorite[];
  loading: boolean;
  error: string | null;
  spotifyFavIds: Set<string>;
};

const FAVORITES_INITIAL_STATE: FavoritesStoreState = {
  favorites: [],
  loading: false,
  error: null,
  spotifyFavIds: new Set<string>(),
};

let favoritesStoreState: FavoritesStoreState = FAVORITES_INITIAL_STATE;
const favoritesStoreListeners = new Set<() => void>();
const pendingByTrack = new Set<string>();
let pendingCount = 0;
let hydratedUserId: string | null = null;
let inFlightFavoritesFetch: Promise<void> | null = null;

function emitFavoritesStore() {
  for (const listener of favoritesStoreListeners) {
    listener();
  }
}

function subscribeFavoritesStore(listener: () => void) {
  favoritesStoreListeners.add(listener);
  return () => {
    favoritesStoreListeners.delete(listener);
  };
}

function getFavoritesStoreSnapshot(): FavoritesStoreState {
  return favoritesStoreState;
}

function updateFavoritesStore(updater: (prev: FavoritesStoreState) => FavoritesStoreState) {
  favoritesStoreState = updater(favoritesStoreState);
  emitFavoritesStore();
}

function setFavoritesStoreError(error: string | null) {
  updateFavoritesStore((prev) => ({ ...prev, error }));
}

function startPending() {
  pendingCount += 1;
  updateFavoritesStore((prev) => ({ ...prev, loading: true }));
}

function endPending() {
  pendingCount = Math.max(0, pendingCount - 1);
  if (pendingCount === 0) {
    updateFavoritesStore((prev) => ({ ...prev, loading: false }));
  }
}

function resetFavoritesStore() {
  pendingByTrack.clear();
  pendingCount = 0;
  inFlightFavoritesFetch = null;
  favoritesStoreState = {
    favorites: [],
    loading: false,
    error: null,
    spotifyFavIds: new Set<string>(),
  };
  emitFavoritesStore();
}

export function __resetFavoritesStoreForTests() {
  hydratedUserId = null;
  resetFavoritesStore();
}

function isDuplicateFavoriteError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const status = 'status' in err ? String((err as { status?: unknown }).status ?? '') : '';
  const message =
    'message' in err ? String((err as { message?: unknown }).message ?? '').toLowerCase() : '';

  return (
    code === '23505' ||
    status === '409' ||
    message.includes('duplicate key') ||
    message.includes('already exists')
  );
}

export function useFavorites(): UseFavorites {
  const { session, user, authLoading } = useAuth();
  const store = useSyncExternalStore(
    subscribeFavoritesStore,
    getFavoritesStoreSnapshot,
    getFavoritesStoreSnapshot,
  );
  const userId = session?.user?.id as string | undefined;

  const getFavorites = useCallback(async () => {
    if (inFlightFavoritesFetch) {
      await inFlightFavoritesFetch;
      return;
    }

    startPending();
    setFavoritesStoreError(null);

    const request = (async () => {
      try {
        if (!user || !userId) {
          resetFavoritesStore();
          return;
        }

        const { data, error } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        updateFavoritesStore((prev) => ({
          ...prev,
          favorites: (data ?? []) as Favorite[],
          spotifyFavIds: new Set<string>(),
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al obtener favoritos';
        setFavoritesStoreError(message);
        console.error('Error fetching favorites from Supabase:', err);
      } finally {
        inFlightFavoritesFetch = null;
        endPending();
      }
    })();

    inFlightFavoritesFetch = request;
    await request;
  }, [user, userId]);

  const addFavorite = useCallback(
    async (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>): Promise<Favorite | null> => {
      const incomingIdentity = canonicalTrackIdentity(track.track_id);
      const existing = getFavoritesStoreSnapshot().favorites.find(
        (f) => canonicalTrackIdentity(f.track_id) === incomingIdentity,
      );

      if (pendingByTrack.has(incomingIdentity)) {
        return existing ?? null;
      }

      if (existing) {
        return existing;
      }

      pendingByTrack.add(incomingIdentity);
      startPending();
      setFavoritesStoreError(null);

      const optimisticFavorite: Favorite = {
        id: `optimistic-${userId ?? 'anon'}-${incomingIdentity}`,
        user_id: userId ?? 'unknown',
        track_id: track.track_id,
        title: track.title,
        artist: track.artist,
        thumbnail_url: track.thumbnail_url,
        created_at: new Date().toISOString(),
      };

      updateFavoritesStore((prev) => ({
        ...prev,
        favorites: [
          optimisticFavorite,
          ...prev.favorites.filter(
            (f) => canonicalTrackIdentity(f.track_id) !== incomingIdentity,
          ),
        ],
      }));

      try {
        if (!user) {
          updateFavoritesStore((prev) => ({
            ...prev,
            favorites: prev.favorites.filter((f) => f.id !== optimisticFavorite.id),
          }));
          setFavoritesStoreError('No hay sesion activa');
          return null;
        }

        if (!userId) {
          updateFavoritesStore((prev) => ({
            ...prev,
            favorites: prev.favorites.filter((f) => f.id !== optimisticFavorite.id),
          }));
          setFavoritesStoreError('No hay sesion activa');
          return null;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          updateFavoritesStore((prev) => ({
            ...prev,
            favorites: prev.favorites.filter((f) => f.id !== optimisticFavorite.id),
          }));
          setFavoritesStoreError(authError.message);
          return null;
        }
        const authUserId = authData.user?.id;
        if (!authUserId) {
          updateFavoritesStore((prev) => ({
            ...prev,
            favorites: prev.favorites.filter((f) => f.id !== optimisticFavorite.id),
          }));
          setFavoritesStoreError('No hay sesion activa');
          return null;
        }

        const { data, error } = await supabase
          .from('favorites')
          .insert({
            user_id: authUserId,
            track_id: track.track_id,
            title: track.title,
            artist: track.artist,
            thumbnail_url: track.thumbnail_url,
          })
          .select('*')
          .single();

        if (error) {
          if (isDuplicateFavoriteError(error)) {
            const { data: existingData } = await supabase
              .from('favorites')
              .select('*')
              .eq('user_id', authUserId)
              .eq('track_id', track.track_id)
              .maybeSingle();

            const existing = (existingData as Favorite | null) ?? {
              id: `favorite-${authUserId}-${track.track_id}`,
              user_id: authUserId,
              track_id: track.track_id,
              title: track.title,
              artist: track.artist,
              thumbnail_url: track.thumbnail_url,
              created_at: new Date().toISOString(),
            };

            updateFavoritesStore((prev) => ({
              ...prev,
              favorites: [
                existing,
                ...prev.favorites.filter(
                  (f) => canonicalTrackIdentity(f.track_id) !== incomingIdentity,
                ),
              ],
            }));
            return existing;
          }

          const message = error instanceof Error ? error.message : 'Error al agregar favorito';
          updateFavoritesStore((prev) => ({
            ...prev,
            favorites: prev.favorites.filter((f) => f.id !== optimisticFavorite.id),
          }));
          setFavoritesStoreError(message);
          console.error('Error adding favorite in Supabase:', error);
          return null;
        }

        const created = data as Favorite;
        updateFavoritesStore((prev) => ({
          ...prev,
          favorites: [
            created,
            ...prev.favorites.filter(
              (f) => canonicalTrackIdentity(f.track_id) !== incomingIdentity,
            ),
          ],
        }));

        return created;
      } catch (err) {
        if (isDuplicateFavoriteError(err)) {
          return getFavoritesStoreSnapshot().favorites.find(
            (f) => canonicalTrackIdentity(f.track_id) === incomingIdentity,
          ) ?? null;
        }

        const message = err instanceof Error ? err.message : 'Error al agregar favorito';
        updateFavoritesStore((prev) => ({
          ...prev,
          favorites: prev.favorites.filter((f) => f.id !== optimisticFavorite.id),
        }));
        setFavoritesStoreError(message);
        console.error('Error adding favorite in Supabase:', err);
        return null;
      } finally {
        pendingByTrack.delete(incomingIdentity);
        endPending();
      }
    },
    [user, userId]
  );

  const removeFavorite = useCallback(
    async (trackId: string): Promise<void> => {
      const identity = canonicalTrackIdentity(trackId);
      const matchedFavorite = getFavoritesStoreSnapshot().favorites.find(
        (f) => canonicalTrackIdentity(f.track_id) === identity,
      );
      const matchedTrackId = matchedFavorite?.track_id ?? trackId;

      startPending();
      setFavoritesStoreError(null);

      updateFavoritesStore((prev) => ({
        ...prev,
        favorites: prev.favorites.filter((f) => canonicalTrackIdentity(f.track_id) !== identity),
      }));

      try {
        if (!user) {
          if (matchedFavorite) {
            updateFavoritesStore((prev) => ({ ...prev, favorites: [matchedFavorite, ...prev.favorites] }));
          }
          setFavoritesStoreError('No hay sesion activa');
          return;
        }

        if (!userId) {
          if (matchedFavorite) {
            updateFavoritesStore((prev) => ({ ...prev, favorites: [matchedFavorite, ...prev.favorites] }));
          }
          setFavoritesStoreError('No hay sesion activa');
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          if (matchedFavorite) {
            updateFavoritesStore((prev) => ({ ...prev, favorites: [matchedFavorite, ...prev.favorites] }));
          }
          setFavoritesStoreError(authError.message);
          return;
        }
        const authUserId = authData.user?.id;
        if (!authUserId) {
          if (matchedFavorite) {
            updateFavoritesStore((prev) => ({ ...prev, favorites: [matchedFavorite, ...prev.favorites] }));
          }
          setFavoritesStoreError('No hay sesion activa');
          return;
        }

        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', authUserId)
          .eq('track_id', matchedTrackId);

        if (error) {
          const message = error instanceof Error ? error.message : 'Error al remover favorito';
          if (matchedFavorite) {
            updateFavoritesStore((prev) => ({ ...prev, favorites: [matchedFavorite, ...prev.favorites] }));
          }
          setFavoritesStoreError(message);
          console.error('Error removing favorite from Supabase:', error);
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al remover favorito';
        if (matchedFavorite) {
          updateFavoritesStore((prev) => ({ ...prev, favorites: [matchedFavorite, ...prev.favorites] }));
        }
        setFavoritesStoreError(message);
        console.error('Error removing favorite from Supabase:', err);
      } finally {
        endPending();
      }
    },
    [user, userId]
  );

  const isFavorite = useCallback(
    (trackId: string) => {
      const identity = canonicalTrackIdentity(trackId);
      return getFavoritesStoreSnapshot().favorites.some(
        (f) => canonicalTrackIdentity(f.track_id) === identity,
      );
    },
    []
  );

  useEffect(() => {
    if (authLoading) return;

    const nextUserId = user?.id ?? null;
    if (nextUserId !== hydratedUserId) {
      hydratedUserId = nextUserId;
      resetFavoritesStore();
    }

    if (!user) {
      return;
    }

    void getFavorites();
  }, [user, authLoading, getFavorites]);

  return {
    favorites: store.favorites,
    loading: store.loading,
    error: store.error,
    spotifyFavIds: store.spotifyFavIds,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
  };
}
