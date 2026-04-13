"use client";

import { API_BASE_URL } from "./api";
import type { YouTubeSearchResult, EnrichedMetadata } from "@/lib/player/types";

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const url = `${API_BASE_URL}/api/youtube/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error("YouTube search failed", res.status);
      return [];
    }

    const data = await safeJson(res);
    if (!Array.isArray(data)) return [];

    return data.map((item: any): YouTubeSearchResult => ({
      youtubeId: item.youtubeId ?? item.id ?? "",
      title: item.title ?? "",
      artistOrChannel: item.artistOrChannel ?? item.channelTitle ?? "",
      thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? "",
      durationSeconds: item.durationSeconds ?? item.duration ?? undefined,
    }));
  } catch (error) {
    console.error("YouTube search error", error);
    return [];
  }
}

export async function fetchEnrichedMetadata(
  title: string,
  artist?: string,
): Promise<EnrichedMetadata | null> {
  const trimmedTitle = title.trim();
  const trimmedArtist = artist?.trim() ?? "";

  if (!trimmedTitle && !trimmedArtist) return null;

  const params = new URLSearchParams();
  if (trimmedTitle) params.set("title", trimmedTitle);
  if (trimmedArtist) params.set("artist", trimmedArtist);

  try {
    const url = `${API_BASE_URL}/api/youtube/metadata?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error("YouTube metadata failed", res.status);
      return null;
    }

    const data = await safeJson(res);
    if (!data) return null;

    return {
      title: data.title ?? trimmedTitle,
      artist: data.artist ?? trimmedArtist,
      thumbnailUrl: data.thumbnailUrl ?? data.thumbnail_url ?? "",
      source: "youtube-search",
    };
  } catch (error) {
    console.error("YouTube metadata error", error);
    return null;
  }
}
