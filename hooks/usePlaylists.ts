'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { authenticatedFetch } from '@/lib/api';
import { usePersistenceAdapter } from '@/lib/persistence';
import type { PersistedPlaylist } from '@/lib/persistence/types';

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
  const persistence = usePersistenceAdapter();

  const getPlaylists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!token) {
        const stored = await persistence.getPlaylists();
        const mapped: Playlist[] = stored.map((p) => ({
          id: p.id,
          user_id: 'guest',
          name: p.name,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }));
        setPlaylists(mapped);
        return;
      }

      const data = await authenticatedFetch('/api/playlists', token);
      setPlaylists(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al obtener playlists';
      setError(message);
      console.error('Error fetching playlists:', err);
    } finally {
      setLoading(false);
    }
  }, [persistence, token]);

  const createPlaylist = useCallback(
    async (name: string): Promise<Playlist> => {
      setLoading(true);
      setError(null);

      try {
        if (!token) {
          const existing = await persistence.getPlaylists();
          const now = new Date().toISOString();
          const id = `guest-playlist-${Date.now().toString(36)}`;

          const persisted: PersistedPlaylist = {
            id,
            name,
            created_at: now,
            updated_at: now,
            tracks: [],
          };

          const updated = [...existing, persisted];
          await persistence.savePlaylists(updated);

          const playlist: Playlist = {
            id,
            user_id: 'guest',
            name,
            created_at: now,
            updated_at: now,
          };

          setPlaylists([...playlists, playlist]);
          return playlist;
        }

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
    [persistence, playlists, token]
  );

  const getPlaylistTracks = useCallback(
    async (playlistId: string): Promise<PlaylistTrack[]> => {
      try {
        if (!token) {
          const stored = await persistence.getPlaylists();
          const playlist = stored.find((p) => p.id === playlistId);
          if (!playlist) return [];

          const mapped: PlaylistTrack[] = playlist.tracks.map((t) => ({
            id: t.id,
            playlist_id: t.playlist_id,
            user_id: 'guest',
            track_id: t.track_id,
            title: t.title,
            artist: t.artist,
            thumbnail_url: t.thumbnail_url,
            duration_seconds: t.duration_seconds,
            position: t.position,
            added_at: t.added_at,
          }));
          return mapped;
        }

        const data = await authenticatedFetch(`/api/playlists/${playlistId}/tracks`, token);
        return data || [];
      } catch (err) {
        console.error('Error fetching playlist tracks:', err);
        throw err;
      }
    },
    [persistence, token]
  );

  const addTrackToPlaylist = useCallback(
    async (
      playlistId: string,
      track: Omit<PlaylistTrack, 'id' | 'playlist_id' | 'user_id' | 'position' | 'added_at'>
    ): Promise<PlaylistTrack> => {
      setLoading(true);
      setError(null);

      try {
        if (!token) {
          const existing = await persistence.getPlaylists();
          const target = existing.find((p) => p.id === playlistId);
          if (!target) {
            throw new Error('Playlist no encontrada en modo guest');
          }

          const now = new Date().toISOString();
          const trackId = `${playlistId}-${track.track_id}`;

          const newTrack = {
            id: trackId,
            playlist_id: playlistId,
            track_id: track.track_id,
            title: track.title,
            artist: track.artist,
            album: undefined,
            thumbnail_url: track.thumbnail_url,
            duration_seconds: track.duration_seconds,
            position: target.tracks.length,
            added_at: now,
          };

          const updatedPlaylists = existing.map((p) =>
            p.id === playlistId ? { ...p, tracks: [...p.tracks, newTrack] } : p,
          );

          await persistence.savePlaylists(updatedPlaylists);

          const playlistTrack: PlaylistTrack = {
            id: newTrack.id,
            playlist_id: playlistId,
            user_id: 'guest',
            track_id: newTrack.track_id,
            title: newTrack.title,
            artist: newTrack.artist,
            thumbnail_url: newTrack.thumbnail_url,
            duration_seconds: newTrack.duration_seconds,
            position: newTrack.position,
            added_at: newTrack.added_at,
          };

          return playlistTrack;
        }

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
    [persistence, token]
  );

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: string, trackId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!token) {
          const existing = await persistence.getPlaylists();
          const updated = existing.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.track_id !== trackId) }
              : p,
          );
          await persistence.savePlaylists(updated);
          return;
        }

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
    [persistence, token]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!token) {
          const existing = await persistence.getPlaylists();
          const updated = existing.filter((p) => p.id !== playlistId);
          await persistence.savePlaylists(updated);
          setPlaylists(playlists.filter((p) => p.id !== playlistId));
          return;
        }

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
    [persistence, playlists, token]
  );

  // Cargar playlists tanto en guest (localStorage) como autenticado (backend)
  useEffect(() => {
    void getPlaylists();
  }, [getPlaylists]);

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
