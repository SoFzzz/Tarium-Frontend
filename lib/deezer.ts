"use client";

import type { DeezerSearchResult } from "@/lib/player/types";

type DeezerApiItem = {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  artist?: {
    name?: string;
  };
  album?: {
    title?: string;
    cover_medium?: string;
    cover_big?: string;
  };
};

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function searchDeezer(query: string): Promise<DeezerSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const response = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      return [];
    }

    const data = await safeJson(response);
    if (!Array.isArray(data)) return [];

    return data
      .map((item: DeezerApiItem): DeezerSearchResult | null => {
        if (!item.id || !item.title || !item.preview) {
          return null;
        }

        return {
          id: String(item.id),
          title: item.title,
          artist: item.artist?.name ?? "Artista desconocido",
          album: item.album?.title,
          thumbnailUrl: item.album?.cover_medium ?? item.album?.cover_big ?? "/placeholder.png",
          previewUrl: item.preview,
          durationSeconds: item.duration,
        };
      })
      .filter((item): item is DeezerSearchResult => item !== null);
  } catch {
    return [];
  }
}
