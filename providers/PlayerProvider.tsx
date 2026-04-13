"use client";

import { createContext, useContext, useState } from "react";

import { usePlayerManager } from "@/hooks/usePlayerManager";
import { BrowserMockMediaAdapter } from "@/lib/player/media-adapter";
import { mockTracks } from "@/lib/player/mock-tracks";
import { PlayerManager } from "@/lib/player/player-manager";

type PlayerContextValue = ReturnType<typeof usePlayerManager>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(
    () => new PlayerManager(mockTracks, new BrowserMockMediaAdapter()),
  );
  const value = usePlayerManager(manager);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (context === null) {
    throw new Error("usePlayer must be used within a PlayerProvider.");
  }

  return context;
}
