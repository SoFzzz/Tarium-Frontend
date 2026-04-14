import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";
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
  if (!accessToken) {
    return NextResponse.json({ error: "No conectado a Spotify" }, { status: 401 });
  }

  const expiresAt = getCookie(request, EXPIRES_AT_COOKIE);

  // If token is expired/near expiry, refresh it to keep SDK happy.
  if (expiresAt) {
    const expiresAtSeconds = Number(expiresAt);
    const now = Math.floor(Date.now() / 1000);
    if (Number.isFinite(expiresAtSeconds) && expiresAtSeconds - now <= 60) {
      const refreshed = await fetch(
        new URL("/api/spotify/refresh", new URL(request.url).origin),
        {
          method: "POST",
          headers: { cookie: request.headers.get("cookie") ?? "" },
          cache: "no-store",
        },
      );

      if (refreshed.ok) {
        // After refresh, the browser will receive updated cookies, but for this response
        // we still return the existing access token value.
      }
    }
  }

  return NextResponse.json({ accessToken, expiresAt });
}
