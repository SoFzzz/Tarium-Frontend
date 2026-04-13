"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { usePlayer } from "@/providers/PlayerProvider";
import { useHistory } from "@/hooks/useHistory";

interface Props {
  children: ReactNode;
}

export function PlayerHistoryProvider({ children }: Props) {
  const { actions } = usePlayer();
  const { registerPlay } = useHistory();

  useEffect(() => {
    const unsubscribe = actions.onTrackPlay((track) => {
      void registerPlay({
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        thumbnail_url: track.thumbnailUrl,
        duration_seconds: track.durationInSeconds,
      });
    });

    return unsubscribe;
  }, [actions, registerPlay]);

  return children;
}
