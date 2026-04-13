'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { authenticatedFetch } from '@/lib/api';

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrack {
  id: string;
  playlist_id: string;
  user_id: string;
  track_id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  duration_seconds?: number;
  position: number;
  added_at: string;
}

interface UsePlaylists {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  getPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  getPlaylistTracks: (playlistId: string) => Promise<PlaylistTrack[]>;
  addTrackToPlaylist: (
    playlistId: string,
    track: Omit<PlaylistTrack, 'id' | 'playlist_id' | 'user_id' | 'position' | 'added_at'>
  ) => Promise<PlaylistTrack>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
}

export function usePlaylists(): UsePlaylists {
  const { session } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.access_token;

  const getPlaylists = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await authenticatedFetch('/api/playlists', token);
      setPlaylists(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al obtener playlists';
      setError(message);
      console.error('Error fetching playlists:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createPlaylist = useCallback(
    async (name: string): Promise<Playlist> => {
      if (!token) throw new Error('No autenticado');

      setLoading(true);
      setError(null);

      try {
        const data = await authenticatedFetch('/api/playlists', token, {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        setPlaylists([...playlists, data]);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al crear playlist';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, playlists]
  );

  const getPlaylistTracks = useCallback(
    async (playlistId: string): Promise<PlaylistTrack[]> => {
      if (!token) throw new Error('No autenticado');

      try {
        const data = await authenticatedFetch(`/api/playlists/${playlistId}/tracks`, token);
        return data || [];
      } catch (err) {
        console.error('Error fetching playlist tracks:', err);
        throw err;
      }
    },
    [token]
  );

  const addTrackToPlaylist = useCallback(
    async (
      playlistId: string,
      track: Omit<PlaylistTrack, 'id' | 'playlist_id' | 'user_id' | 'position' | 'added_at'>
    ): Promise<PlaylistTrack> => {
      if (!token) throw new Error('No autenticado');

      setLoading(true);
      setError(null);

      try {
        const data = await authenticatedFetch(`/api/playlists/${playlistId}/tracks`, token, {
          method: 'POST',
          body: JSON.stringify(track),
        });
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al agregar track';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: string, trackId: string): Promise<void> => {
      if (!token) throw new Error('No autenticado');

      setLoading(true);
      setError(null);

      try {
        await authenticatedFetch(`/api/playlists/${playlistId}/tracks/${trackId}`, token, {
          method: 'DELETE',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al remover track';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string): Promise<void> => {
      if (!token) throw new Error('No autenticado');

      setLoading(true);
      setError(null);

      try {
        await authenticatedFetch(`/api/playlists/${playlistId}`, token, {
          method: 'DELETE',
        });
        setPlaylists(playlists.filter((p) => p.id !== playlistId));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al eliminar playlist';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, playlists]
  );

  // Cargar playlists cuando el token está disponible
  useEffect(() => {
    if (token) {
      getPlaylists();
    }
  }, [token, getPlaylists]);

  return {
    playlists,
    loading,
    error,
    getPlaylists,
    createPlaylist,
    getPlaylistTracks,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
  };
}
