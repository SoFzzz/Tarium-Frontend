import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "spotify_access_token";
const REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_expires_at";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";

  // Clear cookies by setting empty value + immediate expiry.
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, EXPIRES_AT_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
