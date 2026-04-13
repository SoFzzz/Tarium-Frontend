'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { authenticatedFetch } from '@/lib/api';
import { usePersistenceAdapter } from '@/lib/persistence';
import type {
  PersistedFavorite,
  PersistedHistoryEntry,
  PersistedPlaylist,
} from '@/lib/persistence/types';

interface UseGuestMigration {
  migrating: boolean;
  error: string | null;
}

export function useGuestMigration(): UseGuestMigration {
  const { session } = useAuth();
  const persistence = usePersistenceAdapter();
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const migrate = useCallback(async () => {
    if (!session?.access_token) return;
    if (persistence.mode !== 'guest') return;

    setMigrating(true);
    setError(null);

    try {
      const token = session.access_token;

      // Playlists + tracks
      const guestPlaylists: PersistedPlaylist[] = await persistence.getPlaylists();
      for (const playlist of guestPlaylists) {
        const created = await authenticatedFetch('/api/playlists', token, {
          method: 'POST',
          body: JSON.stringify({ name: playlist.name }),
        });

        for (const track of playlist.tracks) {
          await authenticatedFetch(`/api/playlists/${created.id}/tracks`, token, {
            method: 'POST',
            body: JSON.stringify({
              track_id: track.track_id,
              title: track.title,
              artist: track.artist,
              album: track.album,
              thumbnail_url: track.thumbnail_url,
              duration_seconds: track.duration_seconds,
            }),
          });
        }
      }

      // Favoritos
      const guestFavorites: PersistedFavorite[] = await persistence.getFavorites();
      for (const fav of guestFavorites) {
        await authenticatedFetch('/api/favorites', token, {
          method: 'POST',
          body: JSON.stringify({
            track_id: fav.track_id,
            title: fav.title,
            artist: fav.artist,
            album: fav.album,
            thumbnail_url: fav.thumbnail_url,
            duration_seconds: fav.duration_seconds,
          }),
        });
      }

      // Historial (upsert sencillo por track_id)
      const guestHistory: PersistedHistoryEntry[] = await persistence.getHistory();
      for (const h of guestHistory) {
        await authenticatedFetch('/api/history/play', token, {
          method: 'POST',
          body: JSON.stringify({
            track_id: h.track_id,
            title: h.title,
            artist: h.artist,
            album: h.album,
            thumbnail_url: h.thumbnail_url,
            duration_seconds: h.duration_seconds,
          }),
        });
      }
    } catch (err: any) {
      console.error('Error migrating guest data:', err);
      setError(err?.message || 'Error al migrar datos locales');
    } finally {
      setMigrating(false);
    }
  }, [persistence, session]);

  // Ejecutar migración una vez cuando aparece una sesión autenticada.
  useEffect(() => {
    if (session && !migrating) {
      void migrate();
    }
  }, [migrate, migrating, session]);

  return { migrating, error };
}
