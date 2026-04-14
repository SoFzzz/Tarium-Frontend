import { NextResponse } from "next/server";

import { searchTracks, refreshAccessTokenWithExpiresIn } from "@/lib/spotify";

export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";
const REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_expires_at";

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
  const type = searchParams.get("type")?.trim() || "track";
  const limit = searchParams.get("limit") || "20";

  if (!query) {
    return NextResponse.json([]);
  }

  let token = getCookie(request, ACCESS_TOKEN_COOKIE);
  const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);
  const expiresAt = getCookie(request, EXPIRES_AT_COOKIE);

  let refreshed: { accessToken: string; expiresIn: number } | null = null;

  if (token && refreshToken && expiresAt) {
    const expiresAtSeconds = Number(expiresAt);
    const now = Math.floor(Date.now() / 1000);
    if (Number.isFinite(expiresAtSeconds) && expiresAtSeconds - now <= 60) {
      refreshed = await refreshAccessTokenWithExpiresIn(refreshToken);
      token = refreshed.accessToken;
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "No conectado a Spotify" },
      { status: 401 },
    );
  }

  try {
    let data: unknown;

    if (type === "track") {
      // Use the existing helper for track search (backwards compatible)
      data = await searchTracks(query, token);
    } else {
      // Generic search for other types (playlist, album, artist, etc.)
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&limit=${limit}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Spotify ${res.status}`);
      data = await res.json();
    }

    const response = NextResponse.json(data);

    if (refreshed) {
      const isProd = process.env.NODE_ENV === "production";
      const expiresAtSeconds = Math.floor(Date.now() / 1000) + refreshed.expiresIn;
      response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, {
        httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: refreshed.expiresIn,
      });
      response.cookies.set(EXPIRES_AT_COOKIE, String(expiresAtSeconds), {
        httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (err) {
    console.error("Spotify search failed", err);
    return NextResponse.json(
      { error: "No se pudo consultar Spotify" },
      { status: 502 },
    );
  }
}
