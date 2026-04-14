import { type NextRequest, NextResponse } from "next/server";
import { refreshAccessTokenWithExpiresIn } from "@/lib/spotify";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";
const REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_expires_at";

type TokenResult =
  | { token: string; refreshed: null }
  | { token: string; refreshed: { accessToken: string; expiresIn: number } };

/**
 * Reads the Spotify access token from cookies.
 * If the token is missing or expired, it auto-refreshes using the refresh token.
 * Returns null if no valid token can be obtained.
 */
export async function getValidToken(
  request: NextRequest,
): Promise<TokenResult | null> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const expiresAt = request.cookies.get(EXPIRES_AT_COOKIE)?.value;

  // Check if token exists and is not about to expire
  if (accessToken) {
    const expiresAtSeconds = Number(expiresAt);
    const now = Math.floor(Date.now() / 1000);

    // If we have expiry info and token is still valid for > 60s, use it as-is
    if (!expiresAt || !Number.isFinite(expiresAtSeconds) || expiresAtSeconds - now > 60) {
      return { token: accessToken, refreshed: null };
    }
  }

  // Token is missing or about to expire — try refresh
  if (refreshToken) {
    try {
      const result = await refreshAccessTokenWithExpiresIn(refreshToken);
      return { token: result.accessToken, refreshed: result };
    } catch (err) {
      console.error("[spotify-token] refresh failed:", err);
    }
  }

  return null;
}

/**
 * If a token was refreshed, set the updated cookies on the response.
 */
export function applyRefreshedCookies(
  response: NextResponse,
  refreshed: { accessToken: string; expiresIn: number } | null,
): void {
  if (!refreshed) return;

  const isProd = process.env.NODE_ENV === "production";
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + refreshed.expiresIn;

  response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: refreshed.expiresIn,
  });
  response.cookies.set(EXPIRES_AT_COOKIE, String(expiresAtSeconds), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}
