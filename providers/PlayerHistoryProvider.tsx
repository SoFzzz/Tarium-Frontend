"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { usePlayer } from "@/providers/PlayerProvider";
import { useHistory } from "@/hooks/useHistory";
import type { ITrack } from "@/lib/player/types";

interface Props {
  children: ReactNode;
}

export function PlayerHistoryProvider({ children }: Props) {
  const { actions } = usePlayer();
  const { registerPlay } = useHistory();
  const lastRegisteredRef = useRef<string | null>(null);

  useEffect(() => {
    const unregister = actions.onTrackPlay((track: ITrack) => {
      const dedupeKey = `${track.id}:${track.title}`;
      if (lastRegisteredRef.current === dedupeKey) return;
      lastRegisteredRef.current = dedupeKey;

      void registerPlay({
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        thumbnail_url: track.thumbnailUrl,
        duration_seconds: track.durationInSeconds,
      });

      window.setTimeout(() => {
        if (lastRegisteredRef.current === dedupeKey) {
          lastRegisteredRef.current = null;
        }
      }, 1000);
    });

    return unregister;
  }, [actions, registerPlay]);

  return children;
}
