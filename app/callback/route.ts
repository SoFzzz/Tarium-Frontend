import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Spotify redirects here after authorization (/callback).
 * This simply re-routes to the existing /api/spotify/callback handler
 * by forwarding the query params.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = new URL("/api/spotify/callback", request.url);

  // Forward all query params (code, state, error, etc.)
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Also forward cookies so the PKCE verifier/state checks work
  const response = await fetch(targetUrl.toString(), {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    redirect: "manual",
  });

  // The /api/spotify/callback returns a 307 redirect with Set-Cookie headers.
  // We need to forward both the redirect and cookies.
  const location = response.headers.get("location");
  if (location) {
    const res = NextResponse.redirect(location);
    // Forward all Set-Cookie headers from the callback response
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      res.headers.append("set-cookie", cookie);
    }
    return res;
  }

  // Fallback: if no redirect, forward the response as-is
  return NextResponse.redirect(new URL("/?spotify_error=true", request.url));
}
