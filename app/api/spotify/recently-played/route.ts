import { type NextRequest, NextResponse } from "next/server";
import { getRecentlyPlayedAlbums } from "@/lib/spotify";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken(request);
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const albums = await getRecentlyPlayedAlbums(result.token, 50);
    const response = NextResponse.json(albums);
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    console.error("[recently-played]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
