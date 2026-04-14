import { NextResponse } from "next/server";

import { searchTracks } from "@/lib/spotify";

export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    if (key !== name) continue;
    return decodeURIComponent(trimmed.slice(idx + 1));
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json([]);
  }

  const token = getCookie(request, ACCESS_TOKEN_COOKIE);
  if (!token) {
    // Keep response shape consistent for the UI.
    return NextResponse.json(
      { error: "No conectado a Spotify" },
      { status: 401 },
    );
  }

  try {
    const tracks = await searchTracks(query, token);
    return NextResponse.json(tracks);
  } catch (err) {
    console.error("Spotify search failed", err);
    return NextResponse.json(
      { error: "No se pudo consultar Spotify" },
      { status: 502 },
    );
  }
}
