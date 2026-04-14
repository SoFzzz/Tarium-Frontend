import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";
const REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_expires_at";

type TokenResult = {
  token: string;
  refreshed: { accessToken: string; expiresIn: number } | null;
};

/**
 * Reads the Spotify access token from cookies (using next/headers cookies()).
 * If the token is missing or expired, auto-refreshes using the refresh token.
 * Returns null if no valid token can be obtained.
 */
export async function getValidToken(): Promise<TokenResult | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const expiresAtRaw = cookieStore.get(EXPIRES_AT_COOKIE)?.value;

  // Token exists — check if it's still valid
  if (accessToken) {
    const expiresAtSeconds = Number(expiresAtRaw);
    const now = Math.floor(Date.now() / 1000);

    if (!expiresAtRaw || !Number.isFinite(expiresAtSeconds) || expiresAtSeconds - now > 60) {
      return { token: accessToken, refreshed: null };
    }
  }

  // Token missing or about to expire — try refresh
  if (!refreshToken) return null;

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
          ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;

    return {
      token: newToken,
      refreshed: { accessToken: newToken, expiresIn },
    };
  } catch (err) {
    console.error("[spotify-token] refresh failed:", err);
    return null;
  }
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

/**
 * Get a client credentials token (for public endpoints, no user login needed).
 */
export async function getClientCredentialsToken(): Promise<string | null> {
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
          ).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}
