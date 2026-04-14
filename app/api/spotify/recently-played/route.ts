import { NextResponse } from "next/server";
import { getRecentlyPlayedAlbums } from "@/lib/spotify";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getValidToken();
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const albums = await getRecentlyPlayedAlbums(result.token, 50);
    const response = NextResponse.json(albums);
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[recently-played]", msg);

    // If Spotify returned 404 or 403, return empty instead of 500
    if (msg.includes("(404)") || msg.includes("(403)")) {
      return NextResponse.json([]);
    }

    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
