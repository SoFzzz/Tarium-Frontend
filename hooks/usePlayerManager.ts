"use client";

import { useSyncExternalStore } from "react";

import type { PlayerManager } from "@/lib/player/player-manager";

export function usePlayerManager(manager: PlayerManager) {
  const state = useSyncExternalStore(
    (onStoreChange) => manager.subscribe(() => onStoreChange()),
    () => manager.getState(),
    () => manager.getState(),
  );

  return {
    state,
    actions: manager,
  };
}
