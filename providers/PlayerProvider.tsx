"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { usePlayerManager } from "@/hooks/usePlayerManager";
import { PlayerManager } from "@/lib/player/player-manager";
import { MultiSourceAudioAdapter } from "@/lib/player/multi-source-audio-adapter";
import type { ITrack } from "@/lib/player/types";

type PlayerContextValue = ReturnType<typeof usePlayerManager>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

const QUEUE_STORAGE_KEY = "tarium.queue";
const CLEAR_QUEUE_EVENT = "tarium:clear-queue";

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
  const [manager] = useState(
    () => new PlayerManager([], new MultiSourceAudioAdapter()),
  );
  const value = usePlayerManager(manager);

  const lastQueueSigRef = useRef<string>("");

  useEffect(() => {
    let alive = true;

    const rehydrateQueue = async () => {
      // Rehydrate queue after full navigations (e.g. Spotify OAuth redirect).
      try {
        const saved = safeParseQueue(window.localStorage.getItem(QUEUE_STORAGE_KEY));
        if (saved.length === 0 || manager.getState().queue.length > 0) return;

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
        if (restored.length > 0) {
          manager.loadQueue(restored);
        }

        window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(restored));
      } catch {
        // ignore
      }
    };

    void rehydrateQueue();

    return () => {
      alive = false;
    };
  }, [manager]);

  useEffect(() => {
    const clearQueue = () => {
      manager.loadQueue([]);
      try {
        window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([]));
      } catch {
        // ignore
      }
    };

    window.addEventListener(CLEAR_QUEUE_EVENT, clearQueue);
    return () => {
      window.removeEventListener(CLEAR_QUEUE_EVENT, clearQueue);
    };
  }, [manager]);

  useEffect(() => {
    // Persist queue changes, but avoid writing on progress ticks.
    const persistIfChanged = () => {
      try {
        const q = manager.getState().queue.filter(shouldPersistTrack);
        const sig = queueSignature(q);
        if (sig === lastQueueSigRef.current) return;
        lastQueueSigRef.current = sig;
        window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(q));
      } catch {
        // ignore
      }
    };

    // Prime signature and persist current queue once.
    persistIfChanged();

    return manager.subscribe(() => {
      persistIfChanged();
    });
  }, [manager]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (context === null) {
    throw new Error("usePlayer must be used within a PlayerProvider.");
  }

  return context;
}
