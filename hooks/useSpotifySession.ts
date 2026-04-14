"use client";

import { useEffect, useState } from "react";

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

export function useSpotifySession() {
  const [state, setState] = useState<SpotifySessionState>({ status: "loading", me: null });

  useEffect(() => {
    let alive = true;

    // If we just came back from OAuth, the first fetch can race cookie persistence.
    const url = new URL(window.location.href);
    const justConnected = url.searchParams.get("spotify") === "connected";

    const run = async (attempt: number) => {
      try {
        const res = await fetch("/api/spotify/me", { cache: "no-store" });
        if (!alive) return;

        // /me now always returns 200. Body is null when no session, or user object when connected.
        const data = await res.json();

        if (data && data.id) {
          setState({ status: "connected", me: data as SpotifyMe });
          return;
        } else {
          setState({ status: "disconnected", me: null });
        }
      } catch {
        if (!alive) return;
        setState({ status: "disconnected", me: null });
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
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
