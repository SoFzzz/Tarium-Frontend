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

export async function POST(request: Request) {
  const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);
  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
  }

  try {
    const { accessToken, expiresIn } = await refreshAccessTokenWithExpiresIn(refreshToken);

    const response = NextResponse.json({ ok: true });
    const isProd = process.env.NODE_ENV === "production";
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + expiresIn;

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn,
    });
    response.cookies.set(EXPIRES_AT_COOKIE, String(expiresAtSeconds), {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Spotify refresh failed", err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 502 });
  }
}
