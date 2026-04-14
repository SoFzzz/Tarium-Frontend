import { NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: playlistId } = await params;
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const tracks = (data.items || []).map((item: any) => {
      const t = item.track;
      if (!t || !t.id) return null;
      return {
        id: t.id,
        title: t.name,
        artist: t.artists?.map((a: any) => a.name).join(", ") || "Artista desconocido",
        thumbnailUrl: t.album?.images?.[0]?.url || "/placeholder.png",
        durationInSeconds: Math.round((t.duration_ms || 0) / 1000),
        audioUrl: `spotify:track:${t.id}`,
        source: "spotify",
      };
    }).filter(Boolean);

    const response = NextResponse.json(tracks);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[playlist tracks]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
