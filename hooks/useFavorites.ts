'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { authenticatedFetch } from '@/lib/api';

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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.access_token;

  const getFavorites = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await authenticatedFetch('/api/favorites', token);
      setFavorites(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al obtener favoritos';
      setError(message);
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const addFavorite = useCallback(
    async (track: Omit<Favorite, 'id' | 'user_id' | 'created_at'>): Promise<Favorite> => {
      if (!token) throw new Error('No autenticado');

      setLoading(true);
      setError(null);

      try {
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
    [token, favorites]
  );

  const removeFavorite = useCallback(
    async (trackId: string): Promise<void> => {
      if (!token) throw new Error('No autenticado');

      setLoading(true);
      setError(null);

      try {
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
    [token, favorites]
  );

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((f) => f.track_id === trackId),
    [favorites]
  );

  // Cargar favoritos cuando el token está disponible
  useEffect(() => {
    if (token) {
      getFavorites();
    }
  }, [token, getFavorites]);

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
