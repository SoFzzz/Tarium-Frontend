import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "spotify_oauth_state";
const CODE_VERIFIER_COOKIE = "spotify_code_verifier";

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Base64Url(input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest();
  return base64UrlEncode(hash);
}

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
  return new URL("/callback", getRequestOrigin(request)).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing SPOTIFY_CLIENT_ID" },
      { status: 500 },
    );
  }

  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = sha256Base64Url(codeVerifier);
  const state = base64UrlEncode(crypto.randomBytes(16));

  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-top-read",
    "user-read-recently-played",
    "user-library-read",
    "user-library-modify",
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("scope", scopes);

  const response = NextResponse.redirect(authorizeUrl);
  const isProd = process.env.NODE_ENV === "production";

  // Keep these short-lived. They are only needed to complete the OAuth flow.
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  response.cookies.set(CODE_VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
