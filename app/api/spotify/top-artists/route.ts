import { type NextRequest, NextResponse } from "next/server";
import { getTopArtists } from "@/lib/spotify";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken(request);
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const artists = await getTopArtists(result.token, 10);
    const response = NextResponse.json(artists);
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    console.error("[top-artists]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
