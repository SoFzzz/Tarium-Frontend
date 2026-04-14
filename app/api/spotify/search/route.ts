import { type NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() || "track";
    const limit = searchParams.get("limit") || "20";

    if (!query) {
      return NextResponse.json([]);
    }

    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    let data: unknown;

    if (type === "track") {
      data = await searchTracks(query, token);
    } else {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&limit=${limit}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Spotify ${res.status}`);
      data = await res.json();
    }

    const response = NextResponse.json(data);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
