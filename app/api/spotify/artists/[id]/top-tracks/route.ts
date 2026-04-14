import { NextResponse } from "next/server";
import { getArtistTopTracks, refreshAccessTokenWithExpiresIn } from "@/lib/spotify";

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: artistId } = await params;
  let token = getCookie(request, ACCESS_TOKEN_COOKIE);
  const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);
  const expiresAt = getCookie(request, EXPIRES_AT_COOKIE);

  let refreshed: { accessToken: string; expiresIn: number } | null = null;

  if (token && refreshToken && expiresAt) {
    const expiresAtSeconds = Number(expiresAt);
    const now = Math.floor(Date.now() / 1000);
    if (Number.isFinite(expiresAtSeconds) && expiresAtSeconds - now <= 60) {
      try {
        refreshed = await refreshAccessTokenWithExpiresIn(refreshToken);
        token = refreshed.accessToken;
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    }
  }

  if (!token) {
    return NextResponse.json({ error: "No conectado a Spotify" }, { status: 401 });
  }

  try {
    const tracks = await getArtistTopTracks(token, artistId);
    const response = NextResponse.json(tracks);

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
    console.error("Spotify artist top tracks failed", err);
    return NextResponse.json({ error: "No se pudo consultar Spotify" }, { status: 502 });
  }
}
