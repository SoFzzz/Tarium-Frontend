import { NextResponse } from "next/server";
import { getUserPlaylists } from "@/lib/spotify";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getValidToken();
    if (!result) {
      return NextResponse.json([], { status: 200 });
    }

    const playlists = await getUserPlaylists(result.token);
    const response = NextResponse.json(playlists);
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err: unknown) {
    console.error("[me/playlists]", err);
    const message = err instanceof Error ? err.message : "internal";
    if (message.includes("Spotify API error (401)") || message.includes("Spotify API error (403)")) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: "spotify_playlists_failed" }, { status: 502 });
  }
}
