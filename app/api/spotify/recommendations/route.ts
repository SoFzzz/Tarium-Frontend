import { type NextRequest, NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";
import type { ITrack } from "@/lib/player/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    // Stable query. Do not use Spotify IDs inside /v1/search.
    const { searchParams } = new URL(request.url);
    const genre = (searchParams.get("genre") ?? "pop").trim() || "pop";

    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", `genre:${genre}`);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "20");

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      // This route must never break the app if Spotify fails.
      const fallback = NextResponse.json({ tracks: { items: [] } }, { status: 200 });
      applyRefreshedCookies(fallback, result?.refreshed ?? null);
      return fallback;
    }

    const data = (await res.json()) as any;
    const items = (data?.tracks?.items ?? []) as any[];

    const mapped: ITrack[] = items
      .filter(Boolean)
      .map((t) => ({
        id: String(t.id ?? ""),
        title: String(t.name ?? ""),
        artist: Array.isArray(t.artists) ? t.artists.map((a: any) => a?.name).filter(Boolean).join(", ") : "",
        album: t.album?.name,
        thumbnailUrl: t.album?.images?.[0]?.url || "/placeholder.png",
        durationInSeconds: typeof t.duration_ms === "number" ? Math.round(t.duration_ms / 1000) : undefined,
        audioUrl: typeof t.uri === "string" ? t.uri : undefined,
        sourceType: "remote" as const,
        source: "spotify" as const,
      }))
      .filter((t) => Boolean(t.id && t.title));

    const response = NextResponse.json({ tracks: { items: mapped } }, { status: 200 });
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    // Silent fallback: keep UI alive.
    const response = NextResponse.json({ tracks: { items: [] } }, { status: 200 });
    return response;
  }
}
