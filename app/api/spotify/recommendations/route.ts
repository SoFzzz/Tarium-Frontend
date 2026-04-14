import { NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    // Use browse featured playlists as recommendation source
    const res = await fetch(
      `https://api.spotify.com/v1/recommendations?seed_genres=pop,rock,electronic&limit=20`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const tracks = (data.tracks || []).map((t: any) => ({
      id: t.id,
      title: t.name,
      artist: t.artists?.map((a: any) => a.name).join(", ") || "Artista desconocido",
      thumbnailUrl: t.album?.images?.[0]?.url || "/placeholder.png",
      durationInSeconds: Math.round((t.duration_ms || 0) / 1000),
      audioUrl: `spotify:track:${t.id}`,
      source: "spotify",
    }));

    const response = NextResponse.json(tracks);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[recommendations]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
