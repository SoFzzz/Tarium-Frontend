"use client";

import { useCallback, useEffect, useState } from "react";

const SPOTIFY_AUTH_REQUIRED_EVENT = "tarium:spotify-auth-required";

type SpotifyMe = {
  displayName: string | null;
  avatarUrl: string | null;
  id: string | null;
  email: string | null;
};

type SpotifySessionState =
  | { status: "loading"; me: null }
  | { status: "disconnected"; me: null }
  | { status: "connected"; me: SpotifyMe };

const TRANSIENT_OAUTH_PARAMS = ["spotify", "reason", "spotify_error"] as const;

async function hasUsableSpotifyToken(): Promise<boolean> {
  try {
    const tokenRes = await fetch("/api/spotify/token", {
      cache: "no-store",
      credentials: "include",
    });

    if (tokenRes.status === 401) {
      return false;
    }

    return tokenRes.ok;
  } catch {
    return false;
  }
}

export function useSpotifySession() {
  const [state, setState] = useState<SpotifySessionState>({ status: "loading", me: null });

  const stripTransientOAuthParams = useCallback((): { hadConnectedMarker: boolean } => {
    const url = new URL(window.location.href);
    const hadConnectedMarker = url.searchParams.get("spotify") === "connected";

    let changed = false;
    for (const key of TRANSIENT_OAUTH_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, "", url.toString());
    }

    return { hadConnectedMarker };
  }, []);

  const resolveSessionState = useCallback(async (): Promise<SpotifySessionState> => {
    try {
      const res = await fetch("/api/spotify/me", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);
      if (data && data.id) {
        const tokenOk = await hasUsableSpotifyToken();
        if (!tokenOk) {
          return { status: "disconnected", me: null };
        }

        return { status: "connected", me: data as SpotifyMe };
      }

      return { status: "disconnected", me: null };
    } catch {
      return { status: "disconnected", me: null };
    }
  }, []);

  const refresh = useCallback(async () => {
    const next = await resolveSessionState();
    setState(next);
  }, [resolveSessionState]);

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      const { hadConnectedMarker } = stripTransientOAuthParams();
      const maxAttempts = hadConnectedMarker ? 4 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const next = await resolveSessionState();
        if (!alive) return;

        if (next.status === "connected") {
          setState(next);
          return;
        }

        if (attempt < maxAttempts - 1) {
          const delayMs = 300 + attempt * 400;
          await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          continue;
        }

        setState(next);
      }
    };

    const handleSpotifyAuthRequired = () => {
      if (!alive) return;
      setState({ status: "disconnected", me: null });
    };

    const handlePopState = () => {
      if (!alive) return;
      stripTransientOAuthParams();
      void refresh();
    };

    void bootstrap();

    window.addEventListener(SPOTIFY_AUTH_REQUIRED_EVENT, handleSpotifyAuthRequired);
    window.addEventListener("popstate", handlePopState);

    return () => {
      alive = false;
      window.removeEventListener(SPOTIFY_AUTH_REQUIRED_EVENT, handleSpotifyAuthRequired);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [refresh, resolveSessionState, stripTransientOAuthParams]);

  return { ...state, refresh };
}
