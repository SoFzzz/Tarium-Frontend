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

    const seedArtists = "pop,rock,electronic";
    const query = seedArtists.split(",")[0]?.trim() || "pop";
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
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
