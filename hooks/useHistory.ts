'use client';

import { useState, useCallback, useEffect } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { usePersistenceAdapter } from '@/lib/persistence';
import type { PersistedHistoryEntry } from '@/lib/persistence/types';

export interface HistoryEntry {
  track_id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail_url: string;
  duration_seconds?: number;
  play_count: number;
  last_played_at: string;
  created_at: string;
}

interface UseHistory {
  history: HistoryEntry[];
  loading: boolean;
  error: string | null;
  registerPlay: (entry: Omit<HistoryEntry, 'play_count' | 'last_played_at' | 'created_at'>) => Promise<void>;
  getRecent: () => Promise<void>;
}

export function useHistory(): UseHistory {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistence = usePersistenceAdapter();

  const getRecent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // BUGS.txt: No hay backend REST para historial. Mantener solo guest/local.
      if (user) {
        setHistory([]);
        return;
      }

      const stored = await persistence.getHistory();
      const mapped: HistoryEntry[] = stored
        .slice()
        .sort((a, b) => (a.last_played_at < b.last_played_at ? 1 : -1));
      setHistory(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al obtener historial';
      setError(message);
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [persistence, user]);

  const registerPlay = useCallback(
    async (
      entry: Omit<HistoryEntry, 'play_count' | 'last_played_at' | 'created_at'>,
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const now = new Date().toISOString();

        // BUGS.txt: No hay backend REST para historial. Mantener solo guest/local.
        if (user) {
          return;
        }

        // Guest: upsert local por track_id.
        const existing = await persistence.getHistory();
        const index = existing.findIndex((h) => h.track_id === entry.track_id);

        if (index === -1) {
          const created: PersistedHistoryEntry = {
            track_id: entry.track_id,
            title: entry.title,
            artist: entry.artist,
            album: entry.album,
            thumbnail_url: entry.thumbnail_url,
            duration_seconds: entry.duration_seconds,
            play_count: 1,
            last_played_at: now,
            created_at: now,
          };
          const updated = [...existing, created];
          await persistence.saveHistory(updated);
        } else {
          const current = existing[index];
          const updatedEntry: PersistedHistoryEntry = {
            ...current,
            title: entry.title,
            artist: entry.artist,
            album: entry.album,
            thumbnail_url: entry.thumbnail_url,
            duration_seconds: entry.duration_seconds,
            play_count: current.play_count + 1,
            last_played_at: now,
          };
          const updated = [...existing];
          updated[index] = updatedEntry;
          await persistence.saveHistory(updated);
        }

        await getRecent();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al registrar reproducción';
        setError(message);
        console.error('Error registering play in history:', err);
      } finally {
        setLoading(false);
      }
    },
    [getRecent, persistence, user],
  );

  useEffect(() => {
    void getRecent();
  }, [getRecent]);

  return {
    history,
    loading,
    error,
    registerPlay,
    getRecent,
  };
}
