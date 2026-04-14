import { type NextRequest, NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const seedArtists = searchParams.get("seed_artists") ?? "";
    const firstArtist = seedArtists.split(",")[0]?.trim();
    const query = firstArtist ? `artist:${firstArtist}` : "year:2020-2024";
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error("Spotify search failed:", res.status);
      const fallback = NextResponse.json({ tracks: { items: [] } });
      applyRefreshedCookies(fallback, result?.refreshed ?? null);
      return fallback;
    }
    const data = await res.json();
    const tracks = data?.tracks?.items ?? [];
    const response = NextResponse.json({ tracks: { items: tracks } });
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[recommendations]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
