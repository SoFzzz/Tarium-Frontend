'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

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
  const { session, user, authLoading } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id as string | undefined;

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
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al agregar favorito';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, userId]
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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al remover favorito';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, userId]
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
  }, [user, authLoading, getFavorites]);

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
