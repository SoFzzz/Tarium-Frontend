"use client";

import { useEffect, useState } from "react";

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

  const refresh = async () => {
    try {
      const res = await fetch("/api/spotify/me", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (data && data.id) {
        const tokenOk = await hasUsableSpotifyToken();
        if (!tokenOk) {
          setState({ status: "disconnected", me: null });
          return;
        }
        setState({ status: "connected", me: data as SpotifyMe });
      } else {
        setState({ status: "disconnected", me: null });
      }
    } catch {
      setState({ status: "disconnected", me: null });
    }
  };

  useEffect(() => {
    let alive = true;

    // If we just came back from OAuth, the first fetch can race cookie persistence.
    const url = new URL(window.location.href);
    const justConnected = url.searchParams.get("spotify") === "connected";

    // While we retry after OAuth, keep the initial state "loading". Avoid setting state
    // synchronously in the effect body (lint rule).

    const run = async (attempt: number) => {
      try {
        const res = await fetch("/api/spotify/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (!alive) return;

        // /me now always returns 200. Body is null when no session, or user object when connected.
        const data = await res.json();

        if (data && data.id) {
          const tokenOk = await hasUsableSpotifyToken();
          if (!tokenOk) {
            queueMicrotask(() => {
              if (!alive) return;
              setState({ status: "disconnected", me: null });
            });
            return;
          }

          queueMicrotask(() => {
            if (!alive) return;
            setState({ status: "connected", me: data as SpotifyMe });
          });

          // Remove the transient OAuth marker from the URL.
          if (justConnected) {
            const clean = new URL(window.location.href);
            clean.searchParams.delete("spotify");
            clean.searchParams.delete("reason");
            window.history.replaceState(null, "", clean.toString());
          }
          return;
        } else {
          if (!justConnected || attempt >= 3) {
            queueMicrotask(() => {
              if (!alive) return;
              setState({ status: "disconnected", me: null });
            });
          }
        }
      } catch {
        if (!alive) return;
        if (!justConnected || attempt >= 3) {
          queueMicrotask(() => {
            if (!alive) return;
            setState({ status: "disconnected", me: null });
          });
        }
      }

      // Retry a few times after OAuth redirect (common race with fresh cookies).
      if (justConnected && attempt < 3) {
        const delayMs = 300 + attempt * 400;
        window.setTimeout(() => {
          if (!alive) return;
          void run(attempt + 1);
        }, delayMs);
      }
    };

    void run(0);

    const handleSpotifyAuthRequired = () => {
      if (!alive) return;
      setState({ status: "disconnected", me: null });
    };
    window.addEventListener(SPOTIFY_AUTH_REQUIRED_EVENT, handleSpotifyAuthRequired);

    return () => {
      alive = false;
      window.removeEventListener(SPOTIFY_AUTH_REQUIRED_EVENT, handleSpotifyAuthRequired);
    };
  }, []);

  return { ...state, refresh };
}
