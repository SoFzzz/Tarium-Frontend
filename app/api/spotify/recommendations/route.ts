import { type NextRequest, NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";
import type { ITrack } from "@/lib/player/types";

type SpotifyRecTrack = {
  id?: unknown;
  name?: unknown;
  uri?: unknown;
  duration_ms?: unknown;
  artists?: unknown;
  album?: unknown;
};

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const seedArtistsRaw = (searchParams.get("seed_artists") ?? "").trim();
    const seedArtists = seedArtistsRaw
      ? seedArtistsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const genre = (searchParams.get("genre") ?? "pop").trim() || "pop";

    // Prefer Spotify's recommendations endpoint so Home can pass artist seeds.
    const url = new URL("https://api.spotify.com/v1/recommendations");
    url.searchParams.set("limit", "20");
    url.searchParams.set("market", "US");
    if (seedArtists.length > 0) {
      url.searchParams.set("seed_artists", seedArtists.join(","));
    } else {
      url.searchParams.set("seed_genres", genre);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      // This route must never break the app if Spotify fails.
      const fallback = NextResponse.json({ tracks: { items: [] } }, { status: 200 });
      applyRefreshedCookies(fallback, result?.refreshed ?? null);
      return fallback;
    }

    const data = (await res.json()) as unknown;
    const items = (data as { tracks?: unknown })?.tracks;
    const tracks = Array.isArray(items) ? (items as SpotifyRecTrack[]) : [];

    const mapped: ITrack[] = tracks
      .filter(Boolean)
      .map((t) => {
        const artists = Array.isArray(t.artists) ? (t.artists as unknown[]) : [];
        const artist = artists
          .map((a) => {
            if (!a || typeof a !== "object") return null;
            const name = (a as { name?: unknown }).name;
            return typeof name === "string" ? name : null;
          })
          .filter((name): name is string => Boolean(name))
          .join(", ");

        const albumObj = t.album && typeof t.album === "object" ? (t.album as Record<string, unknown>) : null;
        const album = albumObj && typeof albumObj.name === "string" ? albumObj.name : undefined;
        const images = albumObj && Array.isArray(albumObj.images) ? (albumObj.images as unknown[]) : [];
        const firstImage = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>) : null;
        const thumbnailUrl = (firstImage && typeof firstImage.url === "string" ? firstImage.url : "") || "/placeholder.png";

        const durationMs = typeof t.duration_ms === "number" ? t.duration_ms : undefined;

        return {
          id: typeof t.id === "string" ? t.id : String(t.id ?? ""),
          title: typeof t.name === "string" ? t.name : String(t.name ?? ""),
          artist,
          album,
          thumbnailUrl,
          durationInSeconds: typeof durationMs === "number" ? Math.round(durationMs / 1000) : undefined,
          audioUrl: typeof t.uri === "string" ? t.uri : undefined,
          sourceType: "remote" as const,
          source: "spotify" as const,
        } satisfies ITrack;
      })
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
