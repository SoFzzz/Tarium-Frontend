"use client";

import { useState, useCallback } from "react";

import type { LocalTrack } from "@/lib/player/types";

export function useLocalLibrary() {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);

  const addTracks = useCallback((newTracks: LocalTrack[]) => {
    setTracks((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t] as const));

      for (const track of newTracks) {
        byId.set(track.id, track);
      }

      return Array.from(byId.values());
    });
  }, []);

  const clear = useCallback(() => {
    setTracks([]);
  }, []);

  return { tracks, addTracks, clear };
}
