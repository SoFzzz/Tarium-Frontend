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

    const run = async () => {
      try {
        const res = await fetch("/api/spotify/me", { cache: "no-store" });
        if (!alive) return;

        // /me now always returns 200. Body is null when no session, or user object when connected.
        const data = await res.json();

        if (data && data.id) {
          setState({ status: "connected", me: data as SpotifyMe });
        } else {
          setState({ status: "disconnected", me: null });
        }
      } catch {
        if (!alive) return;
        setState({ status: "disconnected", me: null });
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
