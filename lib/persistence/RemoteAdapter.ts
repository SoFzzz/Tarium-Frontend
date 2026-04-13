"use client";

import { authenticatedFetch } from "@/lib/api";
import type {
  PersistenceAdapter,
  PersistedPlaylist,
  PersistedFavorite,
  PersistedHistoryEntry,
} from "./types";

export class RemoteAdapter implements PersistenceAdapter {
  public readonly mode = "authenticated" as const;

  constructor(private readonly token: string) {}

  async getPlaylists(): Promise<PersistedPlaylist[]> {
    const data = await authenticatedFetch("/api/playlists", this.token);
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      updated_at: p.updated_at,
      tracks: [], // los tracks se obtienen por endpoint separado
    }));
  }

  async savePlaylists(_playlists: PersistedPlaylist[]): Promise<void> {
    // La sincronización fina de playlists se hace vía los endpoints REST
    // específicos (/api/playlists, /api/playlists/:id/tracks, etc.).
    // El adapter remoto no sobreescribe masivamente desde cliente.
    return;
  }

  async getFavorites(): Promise<PersistedFavorite[]> {
    const data = await authenticatedFetch("/api/favorites", this.token);
    return (data || []).map((f: any) => ({
      track_id: f.track_id,
      title: f.title,
      artist: f.artist,
      album: f.album,
      thumbnail_url: f.thumbnail_url,
      duration_seconds: f.duration_seconds,
      created_at: f.created_at,
    }));
  }

  async saveFavorites(_favorites: PersistedFavorite[]): Promise<void> {
    // Igual que con playlists: la fuente de verdad es el backend REST.
    return;
  }

  async getHistory(): Promise<PersistedHistoryEntry[]> {
    const data = await authenticatedFetch("/api/history/recent", this.token);
    return (data || []).map((h: any) => ({
      track_id: h.track_id,
      title: h.title,
      artist: h.artist,
      album: h.album,
      thumbnail_url: h.thumbnail_url,
      duration_seconds: h.duration_seconds,
      play_count: h.play_count,
      last_played_at: h.last_played_at,
      created_at: h.created_at,
    }));
  }

  async saveHistory(_history: PersistedHistoryEntry[]): Promise<void> {
    // Igual que arriba: el historial remoto se maneja con /api/history/play.
    return;
  }
}
