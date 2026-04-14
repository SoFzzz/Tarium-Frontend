"use client";

import type {
  PersistenceAdapter,
  PersistedPlaylist,
  PersistedFavorite,
} from "./types";

const PLAYLISTS_KEY = "tarium.playlists";
const FAVORITES_KEY = "tarium.favorites";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export class LocalStorageAdapter implements PersistenceAdapter {
  public readonly mode = "guest" as const;

  async getPlaylists(): Promise<PersistedPlaylist[]> {
    if (!isBrowser()) return [];
    const raw = window.localStorage.getItem(PLAYLISTS_KEY);
    return safeParse<PersistedPlaylist[]>(raw, []);
  }

  async savePlaylists(playlists: PersistedPlaylist[]): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }

  async getFavorites(): Promise<PersistedFavorite[]> {
    if (!isBrowser()) return [];
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    return safeParse<PersistedFavorite[]>(raw, []);
  }

  async saveFavorites(favorites: PersistedFavorite[]): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
}
