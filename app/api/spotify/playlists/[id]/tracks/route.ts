import { NextResponse } from "next/server";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: playlistId } = await params;
    const result = await getValidToken();
    const token = result?.token;
    if (!token) {
      // User playlists require a user token with playlist-read-private.
      return NextResponse.json({ items: [], error: "no_token" }, { status: 200 });
    }

    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const response = NextResponse.json({ items: [], error: res.status }, { status: 200 });
      applyRefreshedCookies(response, result?.refreshed ?? null);
      return response;
    }
    const data = await res.json();

    type SpotifyPlaylistItem = {
      track?: {
        id?: unknown;
        name?: unknown;
        duration_ms?: unknown;
        artists?: unknown;
        album?: unknown;
      };
    };

    const items = Array.isArray(data.items) ? (data.items as SpotifyPlaylistItem[]) : [];
    const tracks = items.map((item) => {
      const t = item.track;
      if (!t || !t.id) return null;

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
      const images = albumObj && Array.isArray(albumObj.images) ? (albumObj.images as unknown[]) : [];
      const firstImage = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>) : null;
      const thumbnailUrl = (firstImage && typeof firstImage.url === "string" ? firstImage.url : "") || "/placeholder.png";

      return {
        id: String(t.id),
        title: typeof t.name === "string" ? t.name : String(t.name ?? ""),
        artist: artist || "Artista desconocido",
        thumbnailUrl,
        durationInSeconds: typeof t.duration_ms === "number" ? Math.round(t.duration_ms / 1000) : 0,
        audioUrl: `spotify:track:${String(t.id)}`,
        source: "spotify" as const,
        sourceType: "remote" as const,
      };
    }).filter(Boolean);

    const response = NextResponse.json(tracks, { status: 200 });
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch {
    return NextResponse.json({ items: [], error: "internal" }, { status: 200 });
  }
}
