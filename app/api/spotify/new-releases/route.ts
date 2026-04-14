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

    const res = await fetch(`https://api.spotify.com/v1/browse/new-releases?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const albums = (data.albums?.items || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      artist: a.artists?.map((ar: any) => ar.name).join(", ") || "Artista desconocido",
      imageUrl: a.images?.[0]?.url || "/placeholder.png",
      totalTracks: a.total_tracks || 0,
    }));

    const response = NextResponse.json(albums);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[new-releases]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
