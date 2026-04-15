"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { usePlayerManager } from "@/hooks/usePlayerManager";
import { PlayerManager } from "@/lib/player/player-manager";
import { MultiSourceAudioAdapter } from "@/lib/player/multi-source-audio-adapter";
import type { ITrack } from "@/lib/player/types";

type PlayerContextValue = ReturnType<typeof usePlayerManager>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

const QUEUE_STORAGE_KEY = "tarium.queue";

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
    // Rehydrate queue after full navigations (e.g. Spotify OAuth redirect).
    try {
      const saved = safeParseQueue(window.localStorage.getItem(QUEUE_STORAGE_KEY));
      if (saved.length > 0 && manager.getState().queue.length === 0) {
        manager.loadQueue(saved);
      }
    } catch {
      // ignore
    }
  }, [manager]);

  useEffect(() => {
    // Persist queue changes, but avoid writing on progress ticks.
    const persistIfChanged = () => {
      try {
        const q = manager.getState().queue;
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
