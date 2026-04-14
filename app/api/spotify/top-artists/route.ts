import { NextResponse } from "next/server";
import { getTopArtists } from "@/lib/spotify";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const artists = await getTopArtists(token, 10);
    const response = NextResponse.json(artists);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[top-artists]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
