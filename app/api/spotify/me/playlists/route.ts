import { type NextRequest, NextResponse } from "next/server";
import { getUserPlaylists } from "@/lib/spotify";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken(request);
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const playlists = await getUserPlaylists(result.token);
    const response = NextResponse.json(playlists);
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    console.error("[me/playlists]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
