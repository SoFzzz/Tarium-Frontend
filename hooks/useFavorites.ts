'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { authenticatedFetch } from '@/lib/api';
import { usePersistenceAdapter } from '@/lib/persistence';
import type { PersistedFavorite } from '@/lib/persistence/types';

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
  getFavorites: () => Promise<void>;
  addFavorite: (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>) => Promise<Favorite>;
  removeFavorite: (trackId: string) => Promise<void>;
  isFavorite: (trackId: string) => boolean;
}

export function useFavorites(): UseFavorites {
  const { session } = useAuth();
  const persistence = usePersistenceAdapter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.access_token;

  const getFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!token) {
        // Guest: leer desde localStorage.
        const stored = await persistence.getFavorites();
        const mapped: Favorite[] = stored.map((f) => ({
          id: f.track_id,
          user_id: 'guest',
          track_id: f.track_id,
          title: f.title,
          artist: f.artist,
          thumbnail_url: f.thumbnail_url,
          created_at: f.created_at,
        }));
        setFavorites(mapped);
        return;
      }

      // Authenticated: backend actual.
      const data = await authenticatedFetch('/api/favorites', token);
      setFavorites(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al obtener favoritos';
      setError(message);
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [persistence, token]);

  const addFavorite = useCallback(
    async (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>): Promise<Favorite> => {
      setLoading(true);
      setError(null);

      try {
        if (!token) {
          // Guest: persistir en localStorage.
          const existing = await persistence.getFavorites();
          const now = new Date().toISOString();
          const newEntry: PersistedFavorite = {
            track_id: track.track_id,
            title: track.title,
            artist: track.artist,
            album: undefined,
            thumbnail_url: track.thumbnail_url,
            duration_seconds: undefined,
            created_at: now,
          };

          const updated = [...existing.filter((f) => f.track_id !== newEntry.track_id), newEntry];
          await persistence.saveFavorites(updated);

          setFavorites([
            ...favorites.filter((f) => f.track_id !== newEntry.track_id),
            {
              id: newEntry.track_id,
              user_id: 'guest',
              track_id: newEntry.track_id,
              title: newEntry.title,
              artist: newEntry.artist,
              thumbnail_url: newEntry.thumbnail_url,
              created_at: newEntry.created_at,
            },
          ]);

          return {
            id: newEntry.track_id,
            user_id: 'guest',
            track_id: newEntry.track_id,
            title: newEntry.title,
            artist: newEntry.artist,
            thumbnail_url: newEntry.thumbnail_url,
            created_at: newEntry.created_at,
          };
        }

        const data = await authenticatedFetch('/api/favorites', token, {
          method: 'POST',
          body: JSON.stringify(track),
        });
        setFavorites([...favorites, data]);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al agregar favorito';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [favorites, persistence, token]
  );

  const removeFavorite = useCallback(
    async (trackId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!token) {
          // Guest: eliminar desde localStorage.
          const existing = await persistence.getFavorites();
          const updated = existing.filter((f) => f.track_id !== trackId);
          await persistence.saveFavorites(updated);
          setFavorites(favorites.filter((f) => f.track_id !== trackId));
          return;
        }

        await authenticatedFetch(`/api/favorites/${trackId}`, token, {
          method: 'DELETE',
        });
        setFavorites(favorites.filter((f) => f.track_id !== trackId));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al remover favorito';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [favorites, persistence, token]
  );

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((f) => f.track_id === trackId),
    [favorites]
  );

  // Cargar favoritos tanto en guest (localStorage) como autenticado (backend)
  useEffect(() => {
    void getFavorites();
  }, [getFavorites]);

  return {
    favorites,
    loading,
    error,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
  };
}
