import { NextResponse } from "next/server";

import { refreshAccessTokenWithExpiresIn } from "@/lib/spotify";

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
  const accessToken = getCookie(request, ACCESS_TOKEN_COOKIE);
  const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);
  const expiresAt = getCookie(request, EXPIRES_AT_COOKIE);

  const now = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = expiresAt ? Number(expiresAt) : NaN;
  const nearExpiry = Number.isFinite(expiresAtSeconds) ? expiresAtSeconds - now <= 60 : false;

  // If we can refresh (near expiry, or missing access token but refresh exists), return a usable token.
  if ((nearExpiry || !accessToken) && refreshToken) {
    try {
      const { accessToken: nextAccessToken, expiresIn } = await refreshAccessTokenWithExpiresIn(refreshToken);
      const isProd = process.env.NODE_ENV === "production";
      const nextExpiresAtSeconds = Math.floor(Date.now() / 1000) + expiresIn;

      const response = NextResponse.json({ accessToken: nextAccessToken, expiresAt: String(nextExpiresAtSeconds) });
      response.cookies.set(ACCESS_TOKEN_COOKIE, nextAccessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: expiresIn,
      });
      response.cookies.set(EXPIRES_AT_COOKIE, String(nextExpiresAtSeconds), {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });

      return response;
    } catch {
      // Fall through to existing cookies (or 401 if none).
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "No conectado a Spotify" }, { status: 401 });
  }

  return NextResponse.json({ accessToken, expiresAt });
}
