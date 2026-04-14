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

async function ensureFreshToken(request: Request): Promise<void> {
  const expiresAt = getCookie(request, EXPIRES_AT_COOKIE);
  if (!expiresAt) return;
  const expiresAtSeconds = Number(expiresAt);
  if (!Number.isFinite(expiresAtSeconds)) return;

  // Refresh if token expires soon (within 60s).
  const now = Math.floor(Date.now() / 1000);
  if (expiresAtSeconds - now > 60) return;

  // Internal call to refresh endpoint which updates cookies.
  // Note: cookies set by that call won't automatically apply here;
  // this is mainly a best-effort preflight for client UX.
  await fetch(new URL("/api/spotify/refresh", new URL(request.url).origin), {
    method: "POST",
    headers: { cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
  }).catch(() => {});
}

export async function GET(request: Request) {
  await ensureFreshToken(request);

  const token = getCookie(request, ACCESS_TOKEN_COOKIE);
  if (!token) {
    return NextResponse.json({ error: "No conectado" }, { status: 401 });
  }

  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "No se pudo obtener perfil" }, { status: 502 });
  }

  const data = (await res.json()) as {
    display_name?: string;
    images?: { url: string }[];
    id?: string;
    email?: string;
  };

  return NextResponse.json({
    displayName: data.display_name ?? null,
    avatarUrl: data.images?.[0]?.url ?? null,
    id: data.id ?? null,
    email: data.email ?? null,
  });
}
