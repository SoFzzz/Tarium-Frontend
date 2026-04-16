"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { usePlayerManager } from "@/hooks/usePlayerManager";
import { PlayerManager } from "@/lib/player/player-manager";
import { MultiSourceAudioAdapter } from "@/lib/player/multi-source-audio-adapter";
import type { ITrack } from "@/lib/player/types";
import { useAuth } from "@/providers/AuthProvider";

type PlayerContextValue = ReturnType<typeof usePlayerManager>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

const QUEUE_STORAGE_KEY_PREFIX = "tarium.queue";
const LEGACY_QUEUE_STORAGE_KEY = QUEUE_STORAGE_KEY_PREFIX;
const CLEAR_QUEUE_EVENT = "tarium:clear-queue";

function getQueueStorageKey(userId: string): string {
  return `${QUEUE_STORAGE_KEY_PREFIX}:${userId}`;
}

function isTrackValidAcrossSessions(track: ITrack): boolean {
  if (track.sourceType === "local" || track.source === "local") return false;
  if (track.objectUrl?.startsWith("blob:")) return false;
  return true;
}

function shouldPersistTrack(track: ITrack): boolean {
  return isTrackValidAcrossSessions(track);
}

function canRestoreTrack(track: ITrack, spotifyConnected: boolean): boolean {
  if (!isTrackValidAcrossSessions(track)) return false;

  const isSpotifyTrack =
    track.source === "spotify" || track.audioUrl?.startsWith("spotify:") === true;

  if (isSpotifyTrack && !spotifyConnected) return false;
  return true;
}

function safeParseQueue(raw: string | null): ITrack[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (t): t is Partial<ITrack> & { id: unknown } =>
          Boolean(t && typeof t === "object" && "id" in (t as Record<string, unknown>)),
      )
      .map((t) => {
        const obj = t as Record<string, unknown>;
        return {
          id: String(obj.id ?? ""),
          title: String(obj.title ?? ""),
          artist: String(obj.artist ?? ""),
          thumbnailUrl: String(obj.thumbnailUrl ?? "/placeholder.png"),
          album: typeof obj.album === "string" ? obj.album : undefined,
          durationInSeconds:
            typeof obj.durationInSeconds === "number" ? obj.durationInSeconds : undefined,
          audioUrl: typeof obj.audioUrl === "string" ? obj.audioUrl : undefined,
          fileName: typeof obj.fileName === "string" ? obj.fileName : undefined,
          objectUrl: typeof obj.objectUrl === "string" ? obj.objectUrl : undefined,
          sourceType:
            obj.sourceType === "local" || obj.sourceType === "remote"
              ? obj.sourceType
              : undefined,
          source:
            obj.source === "spotify" ||
            obj.source === "deezer" ||
            obj.source === "youtube" ||
            obj.source === "local" ||
            obj.source === "jamendo"
              ? obj.source
              : undefined,
        } satisfies ITrack;
      })
      .filter((t) => t.id.length > 0 && t.title.length > 0);
  } catch {
    return [];
  }
}

function queueSignature(queue: ITrack[]): string {
  // Use order-sensitive IDs to detect meaningful queue changes.
  return queue.map((t) => t.id).join("\u0001");
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useAuth();
  const [manager] = useState(
    () => new PlayerManager([], new MultiSourceAudioAdapter()),
  );
  const value = usePlayerManager(manager);

  const lastQueueSigRef = useRef<string>("");
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    const syncQueueForSession = async () => {
      if (authLoading) return;

      const currentUserId = user?.id ?? null;
      const previousUserId = lastUserIdRef.current;

      try {
        window.localStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
      } catch {
        // ignore
      }

      if (!currentUserId) {
        if (previousUserId) {
          try {
            window.localStorage.removeItem(getQueueStorageKey(previousUserId));
          } catch {
            // ignore
          }
        }

        if (!alive) return;
        manager.restoreQueueWithoutCurrent([]);
        lastQueueSigRef.current = "";
        lastUserIdRef.current = null;
        return;
      }

      if (previousUserId === currentUserId) return;

      try {
        const saved = safeParseQueue(window.localStorage.getItem(getQueueStorageKey(currentUserId)));
        let spotifyConnected = false;
        try {
          const res = await fetch("/api/spotify/me", { cache: "no-store" });
          const data = (await res.json()) as { id?: unknown } | null;
          spotifyConnected = Boolean(data && typeof data.id === "string" && data.id.length > 0);
        } catch {
          spotifyConnected = false;
        }

        if (!alive) return;

        const restored = saved.filter((track) => canRestoreTrack(track, spotifyConnected));
        manager.restoreQueueWithoutCurrent(restored);
        lastQueueSigRef.current = queueSignature(restored);
        lastUserIdRef.current = currentUserId;
        window.localStorage.setItem(getQueueStorageKey(currentUserId), JSON.stringify(restored));
      } catch {
        // ignore
      }
    };

    void syncQueueForSession();

    return () => {
      alive = false;
    };
  }, [authLoading, manager, user?.id]);

  useEffect(() => {
    const clearQueue = (event: Event) => {
      const detail =
        event instanceof CustomEvent && typeof event.detail === "object" && event.detail
          ? (event.detail as { userId?: string | null })
          : null;

      void manager.stopAndClear().finally(() => {
        lastQueueSigRef.current = "";

        try {
          window.localStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
          if (user?.id) {
            window.localStorage.removeItem(getQueueStorageKey(user.id));
          }
          if (detail?.userId) {
            window.localStorage.removeItem(getQueueStorageKey(detail.userId));
          }
        } catch {
          // ignore
        }
      });
    };

    window.addEventListener(CLEAR_QUEUE_EVENT, clearQueue);
    return () => {
      window.removeEventListener(CLEAR_QUEUE_EVENT, clearQueue);
    };
  }, [manager, user?.id]);

  useEffect(() => {
    // Persist queue changes, but avoid writing on progress ticks.
    const persistIfChanged = () => {
      if (authLoading || !user?.id) {
        lastQueueSigRef.current = "";
        try {
          window.localStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }

      try {
        const q = manager.getState().queue.filter(shouldPersistTrack);
        const sig = queueSignature(q);
        if (sig === lastQueueSigRef.current) return;
        lastQueueSigRef.current = sig;
        window.localStorage.setItem(getQueueStorageKey(user.id), JSON.stringify(q));
      } catch {
        // ignore
      }
    };

    // Prime signature and persist current queue once.
    persistIfChanged();

    return manager.subscribe(() => {
      persistIfChanged();
    });
  }, [authLoading, manager, user?.id]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (context === null) {
    throw new Error("usePlayer must be used within a PlayerProvider.");
  }

  return context;
}
