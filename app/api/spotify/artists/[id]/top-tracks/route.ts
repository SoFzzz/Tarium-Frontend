import { NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

type SpotifyArtistTopTrack = {
  id?: unknown;
  name?: unknown;
  duration_ms?: unknown;
  artists?: unknown;
  album?: unknown;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: artistId } = await params;
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const res = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const rawTracks = Array.isArray(data.tracks) ? (data.tracks as SpotifyArtistTopTrack[]) : [];
    const tracks = rawTracks
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        if (!t.id) return null;

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
        };
      })
      .filter(Boolean);

    const response = NextResponse.json(tracks);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[artist top-tracks]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
