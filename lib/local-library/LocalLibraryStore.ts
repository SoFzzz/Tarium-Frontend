"use client";

import { useCallback, useState } from "react";

import type { LocalTrack } from "@/lib/player/types";

// Simple local library hook that owns LocalTrack[] and ensures
// object URLs are revoked when tracks are removed or the library is cleared.
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

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => {
      const target = prev.find((t) => t.id === id);

      if (target) {
        URL.revokeObjectURL(target.objectUrl);
      }

      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const clearLibrary = useCallback(() => {
    setTracks((prev) => {
      for (const track of prev) {
        URL.revokeObjectURL(track.objectUrl);
      }

      return [];
    });
  }, []);

  return { tracks, addTracks, removeTrack, clearLibrary };
}
