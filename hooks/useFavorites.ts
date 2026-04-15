'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useSpotifySession } from '@/hooks/useSpotifySession';

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
  addFavorite: (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>) => Promise<Favorite>;
  removeFavorite: (trackId: string) => Promise<void>;
  isFavorite: (trackId: string) => boolean;
}

export function useFavorites(): UseFavorites {
  const { session, user, authLoading } = useAuth();
  const spotifySession = useSpotifySession();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotifyFavIds, setSpotifyFavIds] = useState<Set<string>>(new Set());

  const userId = session?.user?.id as string | undefined;

  // Spotify track IDs are 22-char base62. Some flows may store a full URI.
  const isSpotifyTrackId = (id: string | null | undefined) => {
    if (!id) return false;
    if (id.startsWith('spotify:track:')) return true;
    return /^[A-Za-z0-9]{22}$/.test(id);
  };

  const getFavorites = useCallback(async () => {
    setLoading(true);
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
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [user, userId]);

  const addFavorite = useCallback(
    async (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>): Promise<Favorite> => {
      setLoading(true);
      setError(null);

      try {
        if (!user) {
          throw new Error('No hay sesion activa');
        }

        if (!userId) {
          throw new Error('No hay sesion activa');
        }

        const { data, error } = await supabase
          .from('favorites')
          .insert({
            user_id: userId,
            track_id: track.track_id,
            title: track.title,
            artist: track.artist,
            thumbnail_url: track.thumbnail_url,
          })
          .select('*')
          .single();

        if (error) throw error;
        const created = data as Favorite;
        setFavorites((prev) => [created, ...prev.filter((f) => f.track_id !== created.track_id)]);

        // Sync to Spotify only when Spotify is connected and the track is Spotify.
        if (spotifySession.status === 'connected' && isSpotifyTrackId(track.track_id)) {
          fetch('/api/spotify/me/tracks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [track.track_id] }),
          })
            .then((r) => {
              if (!r.ok) return;
              setSpotifyFavIds((prev) => new Set(prev).add(track.track_id));
            })
            .catch(() => {
              /* silently fail spotify sync */
            });
        }

        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al agregar favorito';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, userId, spotifySession.status]
  );

  const removeFavorite = useCallback(
    async (trackId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!user) {
          throw new Error('No hay sesion activa');
        }

        if (!userId) {
          throw new Error('No hay sesion activa');
        }

        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('track_id', trackId);

        if (error) throw error;
        setFavorites((prev) => prev.filter((f) => f.track_id !== trackId));

        // Remove from Spotify too (only when connected and Spotify track).
        if (spotifySession.status === 'connected' && isSpotifyTrackId(trackId)) {
          fetch('/api/spotify/me/tracks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [trackId] }),
          })
            .then((r) => {
              if (!r.ok) return;
              setSpotifyFavIds((prev) => {
                const next = new Set(prev);
                next.delete(trackId);
                return next;
              });
            })
            .catch(() => {
              /* silently fail spotify sync */
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al remover favorito';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, userId, spotifySession.status]
  );

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((f) => f.track_id === trackId),
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

    // Also load Spotify saved tracks for merge/badge (only when connected).
    if (spotifySession.status === 'connected') {
      fetch('/api/spotify/me/tracks')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data)) {
            const ids = data
              .map((t): string | null => {
                if (!t || typeof t !== 'object') return null;
                const id = (t as { id?: unknown }).id;
                return typeof id === 'string' ? id : null;
              })
              .filter((id): id is string => Boolean(id));
            setSpotifyFavIds(new Set(ids));
          }
        })
        .catch(() => {
          /* not connected or error */
        });
    } else {
      setSpotifyFavIds(new Set());
    }
  }, [user, authLoading, getFavorites, spotifySession.status]);

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
