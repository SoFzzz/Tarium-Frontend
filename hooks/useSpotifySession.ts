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
  | { status: "connected"; me: SpotifyMe }
  | { status: "error"; me: null };

export function useSpotifySession() {
  const [state, setState] = useState<SpotifySessionState>({ status: "loading", me: null });

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        const res = await fetch("/api/spotify/me", { cache: "no-store" });
        if (!alive) return;

        if (res.status === 401) {
          setState({ status: "disconnected", me: null });
          return;
        }

        if (!res.ok) {
          setState({ status: "error", me: null });
          return;
        }

        const me = (await res.json()) as SpotifyMe;
        setState({ status: "connected", me });
      } catch {
        if (!alive) return;
        setState({ status: "error", me: null });
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
