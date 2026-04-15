'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotifyFavIds, setSpotifyFavIds] = useState<Set<string>>(new Set());
  const favoritesRef = useRef<Favorite[]>([]);
  const pendingByTrack = useRef<Set<string>>(new Set());
  const pendingCount = useRef(0);

  const userId = session?.user?.id as string | undefined;

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const startPending = useCallback(() => {
    pendingCount.current += 1;
    setLoading(true);
  }, []);

  const endPending = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current === 0) {
      setLoading(false);
    }
  }, []);

  const getFavorites = useCallback(async () => {
    startPending();
    setError(null);

    try {
      // Sin login: no montar/llamar a queries de Supabase.
      if (!user) {
        setFavorites([]);
        return;
      }

      if (!userId) {
        setFavorites([]);
        return;
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites((data ?? []) as Favorite[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al obtener favoritos';
      setError(message);
      console.error('Error fetching favorites from Supabase:', err);
    } finally {
      endPending();
    }
  }, [user, userId, startPending, endPending]);

  const addFavorite = useCallback(
    async (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>): Promise<Favorite | null> => {
      const incomingIdentity = canonicalTrackIdentity(track.track_id);

      if (pendingByTrack.current.has(incomingIdentity)) {
        return (
          favoritesRef.current.find(
            (f) => canonicalTrackIdentity(f.track_id) === incomingIdentity
          ) ?? null
        );
      }

      if (
        favoritesRef.current.some(
          (f) => canonicalTrackIdentity(f.track_id) === incomingIdentity
        )
      ) {
        return (
          favoritesRef.current.find(
            (f) => canonicalTrackIdentity(f.track_id) === incomingIdentity
          ) ?? null
        );
      }

      pendingByTrack.current.add(incomingIdentity);
      startPending();
      setError(null);

      try {
        if (!user) {
          setError('No hay sesion activa');
          return null;
        }

        if (!userId) {
          setError('No hay sesion activa');
          return null;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          setError(authError.message);
          return null;
        }
        const authUserId = authData.user?.id;
        if (!authUserId) {
          setError('No hay sesion activa');
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

            setFavorites((prev) => [existing, ...prev.filter((f) => f.track_id !== existing.track_id)]);
            return existing;
          }

          const message = error instanceof Error ? error.message : 'Error al agregar favorito';
          setError(message);
          console.error('Error adding favorite in Supabase:', error);
          return null;
        }

        const created = data as Favorite;
        setFavorites((prev) => [created, ...prev.filter((f) => f.track_id !== created.track_id)]);

        return created;
      } catch (err) {
        if (isDuplicateFavoriteError(err)) {
          return (
            favoritesRef.current.find(
              (f) => canonicalTrackIdentity(f.track_id) === incomingIdentity
            ) ?? null
          );
        }

        const message = err instanceof Error ? err.message : 'Error al agregar favorito';
        setError(message);
        console.error('Error adding favorite in Supabase:', err);
        return null;
      } finally {
        pendingByTrack.current.delete(incomingIdentity);
        endPending();
      }
    },
    [user, userId, startPending, endPending]
  );

  const removeFavorite = useCallback(
    async (trackId: string): Promise<void> => {
      const identity = canonicalTrackIdentity(trackId);
      const matchedTrackId =
        favoritesRef.current.find((f) => canonicalTrackIdentity(f.track_id) === identity)?.track_id ??
        trackId;

      startPending();
      setError(null);

      try {
        if (!user) {
          setError('No hay sesion activa');
          return;
        }

        if (!userId) {
          setError('No hay sesion activa');
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          setError(authError.message);
          return;
        }
        const authUserId = authData.user?.id;
        if (!authUserId) {
          setError('No hay sesion activa');
          return;
        }

        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', authUserId)
          .eq('track_id', matchedTrackId);

        if (error) {
          const message = error instanceof Error ? error.message : 'Error al remover favorito';
          setError(message);
          console.error('Error removing favorite from Supabase:', error);
          return;
        }

        setFavorites((prev) =>
          prev.filter((f) => canonicalTrackIdentity(f.track_id) !== identity)
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al remover favorito';
        setError(message);
        console.error('Error removing favorite from Supabase:', err);
      } finally {
        endPending();
      }
    },
    [user, userId, startPending, endPending]
  );

  const isFavorite = useCallback(
    (trackId: string) => {
      const identity = canonicalTrackIdentity(trackId);
      return favorites.some((f) => canonicalTrackIdentity(f.track_id) === identity);
    },
    [favorites]
  );

  useEffect(() => {
    // Esperar a que auth resuelva la sesion inicial para evitar limpiar el estado
    // si hay una sesion persistida (flash de user=null).
    if (authLoading) return;

    if (!user) {
      setFavorites([]);
      return;
    }

    void getFavorites();
    setSpotifyFavIds(new Set());
  }, [user, authLoading, getFavorites]);

  return {
    favorites,
    loading,
    error,
    spotifyFavIds,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
  };
}
