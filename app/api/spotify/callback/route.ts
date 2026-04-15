import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "spotify_oauth_state";
const CODE_VERIFIER_COOKIE = "spotify_code_verifier";
const CONSUMED_STATE_COOKIE = "spotify_oauth_state_consumed";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";
const REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_expires_at";

function getRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

function getRedirectUri(request: Request): string {
  const configured = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL("/api/spotify/callback", getRequestOrigin(request)).toString();
}

function redirectHome(request: Request, params?: Record<string, string>): NextResponse {
  const url = new URL("/", getRequestOrigin(request));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const response = NextResponse.redirect(url, { status: 302 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirectHome(request, { spotify: "error", reason: error });
  }

  if (!code || !state) {
    return redirectHome(request, { spotify: "error", reason: "missing_code" });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Missing SPOTIFY_CLIENT_ID" },
      { status: 500 },
    );
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf("=");
        if (idx === -1) return [pair, ""] as const;
        return [pair.slice(0, idx), decodeURIComponent(pair.slice(idx + 1))] as const;
      }),
  );

  const storedState = cookies.get(OAUTH_STATE_COOKIE);
  const codeVerifier = cookies.get(CODE_VERIFIER_COOKIE);
  const consumedState = cookies.get(CONSUMED_STATE_COOKIE);

  if (consumedState && consumedState === state) {
    return redirectHome(request, { spotify: "connected" });
  }

  if (!storedState || storedState !== state) {
    return redirectHome(request, { spotify: "error", reason: "state_mismatch" });
  }

  if (!codeVerifier) {
    return redirectHome(request, { spotify: "error", reason: "missing_verifier" });
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", getRedirectUri(request));
  body.set("client_id", clientId);
  body.set("code_verifier", codeVerifier);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body,
    // This endpoint must not be cached.
    next: { revalidate: 0 },
  });

  if (!tokenRes.ok) {
    return redirectHome(request, { spotify: "error", reason: "token_exchange_failed" });
  }

  const data = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : null;

  if (!accessToken || !refreshToken || !expiresIn) {
    return redirectHome(request, { spotify: "error", reason: "invalid_token_payload" });
  }

  const response = redirectHome(request, { spotify: "connected" });
  const isProd = process.env.NODE_ENV === "production";

  const expiresAtSeconds = Math.floor(Date.now() / 1000) + expiresIn;

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    // Keep refresh token longer-lived.
    maxAge: 30 * 24 * 60 * 60,
  });
  response.cookies.set(EXPIRES_AT_COOKIE, String(expiresAtSeconds), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  // Cleanup flow cookies.
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(CODE_VERIFIER_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(CONSUMED_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
