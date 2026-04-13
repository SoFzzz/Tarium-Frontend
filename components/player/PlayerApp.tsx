"use client";

import { PlayerProvider } from "@/providers/PlayerProvider";
import { PlayerShell } from "./PlayerShell";

export function PlayerApp() {
  return (
    <PlayerProvider>
      <PlayerShell />
    </PlayerProvider>
  );
}
