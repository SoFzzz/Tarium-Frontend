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

async function getToken(request: Request) {
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
  return { token, refreshed };
}

function withRefreshedCookies(response: NextResponse, refreshed: { accessToken: string; expiresIn: number } | null) {
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
}

// GET /api/spotify/me/tracks — fetch user's saved tracks
export async function GET(request: Request) {
  const { token, refreshed } = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "No conectado a Spotify" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") || "50";
    const res = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const tracks = (data.items || []).map((item: any) => {
      const t = item.track;
      if (!t || !t.id) return null;
      return {
        id: t.id,
        title: t.name,
        artist: t.artists?.map((a: any) => a.name).join(", ") || "Artista desconocido",
        thumbnailUrl: t.album?.images?.[0]?.url || "/placeholder.png",
        durationInSeconds: Math.round((t.duration_ms || 0) / 1000),
        audioUrl: `spotify:track:${t.id}`,
        source: "spotify" as const,
        fromSpotify: true,
      };
    }).filter(Boolean);

    return withRefreshedCookies(NextResponse.json(tracks), refreshed);
  } catch (err) {
    console.error("Spotify saved tracks failed", err);
    return NextResponse.json({ error: "No se pudo consultar Spotify" }, { status: 502 });
  }
}

// PUT /api/spotify/me/tracks — save tracks to user's library
export async function PUT(request: Request) {
  const { token, refreshed } = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "No conectado a Spotify" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No track ids provided" }, { status: 400 });
    }

    const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${ids.join(",")}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    return withRefreshedCookies(NextResponse.json({ ok: true }), refreshed);
  } catch (err) {
    console.error("Spotify save track failed", err);
    return NextResponse.json({ error: "No se pudo guardar en Spotify" }, { status: 502 });
  }
}

// DELETE /api/spotify/me/tracks — remove tracks from user's library
export async function DELETE(request: Request) {
  const { token, refreshed } = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "No conectado a Spotify" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No track ids provided" }, { status: 400 });
    }

    const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${ids.join(",")}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    return withRefreshedCookies(NextResponse.json({ ok: true }), refreshed);
  } catch (err) {
    console.error("Spotify remove track failed", err);
    return NextResponse.json({ error: "No se pudo eliminar de Spotify" }, { status: 502 });
  }
}
