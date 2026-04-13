"use client";

import { PlayerProvider } from "@/providers/PlayerProvider";
import { PlayerShell } from "./PlayerShell";
import { PlayerHistoryProvider } from "@/providers/PlayerHistoryProvider";

export function PlayerApp() {
  return (
    <PlayerProvider>
      <PlayerHistoryProvider>
        <PlayerShell />
      </PlayerHistoryProvider>
    </PlayerProvider>
  );
}
