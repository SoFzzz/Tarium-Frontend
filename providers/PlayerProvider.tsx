"use client";

import { createContext, useContext, useState } from "react";

import { usePlayerManager } from "@/hooks/usePlayerManager";
import { PlayerManager } from "@/lib/player/player-manager";
import { MultiSourceAudioAdapter } from "@/lib/player/multi-source-audio-adapter";

type PlayerContextValue = ReturnType<typeof usePlayerManager>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(
    () => new PlayerManager([], new MultiSourceAudioAdapter()),
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
