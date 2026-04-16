const TRANSIENT_SPOTIFY_PARAMS = ["spotify", "reason", "spotify_error"] as const;
const CALLBACK_PATHS = new Set(["/callback", "/api/spotify/callback"]);

export function sanitizeSpotifyUrlState(href: string): {
  changed: boolean;
  hadConnectedMarker: boolean;
  sanitizedUrl: string;
} {
  const url = new URL(href);
  const hadConnectedMarker = url.searchParams.get("spotify") === "connected";

  let changed = false;
  for (const key of TRANSIENT_SPOTIFY_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (CALLBACK_PATHS.has(url.pathname)) {
    url.pathname = "/";
    changed = true;
  }

  return {
    changed,
    hadConnectedMarker,
    sanitizedUrl: url.toString(),
  };
}
