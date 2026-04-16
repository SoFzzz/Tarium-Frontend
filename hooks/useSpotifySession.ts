"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeSpotifyUrlState } from "@/lib/auth/spotify-url-state";
import { useAuth } from "@/providers/AuthProvider";

const SPOTIFY_AUTH_REQUIRED_EVENT = "tarium:spotify-auth-required";
const CONNECT_RETRY_DELAYS_MS = [300, 700, 1300, 2100] as const;

type SpotifyMe = {
  displayName: string | null;
  avatarUrl: string | null;
  id: string | null;
  email: string | null;
};

type SpotifySessionState =
  | { status: "loading"; me: null; warning: string | null }
  | { status: "connecting"; me: null; warning: string | null }
  | { status: "disconnected"; me: null; warning: string | null }
  | { status: "connected"; me: SpotifyMe; warning: string | null };

const BLOCKED_BY_CLIENT_WARNING =
  "Tu bloqueador puede interferir con Spotify; prueba desactivarlo para este sitio.";

function isBlockedByClientError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("blocked_by_client");
}

async function hasUsableSpotifyToken(): Promise<{ ok: boolean; warning: string | null }> {
  try {
    const tokenRes = await fetch("/api/spotify/token", {
      cache: "no-store",
      credentials: "include",
    });

    if (tokenRes.status === 401) {
      return { ok: false, warning: null };
    }

    return { ok: tokenRes.ok, warning: null };
  } catch (error) {
    return {
      ok: false,
      warning: isBlockedByClientError(error) ? BLOCKED_BY_CLIENT_WARNING : null,
    };
  }
}

export function useSpotifySession() {
  const { user, authLoading } = useAuth();
  const [state, setState] = useState<SpotifySessionState>({
    status: "loading",
    me: null,
    warning: null,
  });
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  const stripTransientOAuthParams = useCallback((): { hadConnectedMarker: boolean } => {
    const { changed, hadConnectedMarker, sanitizedUrl } = sanitizeSpotifyUrlState(window.location.href);

    if (changed) {
      window.history.replaceState(window.history.state, "", sanitizedUrl);
    }

    return { hadConnectedMarker };
  }, []);

  const resolveSessionState = useCallback(async (): Promise<SpotifySessionState> => {
    if (authLoading) {
      return { status: "loading", me: null, warning: null };
    }

    if (!user) {
      return { status: "disconnected", me: null, warning: null };
    }

    setState({ status: "connecting", me: null, warning: null });

    try {
      const res = await fetch("/api/spotify/me", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);
      if (data && data.id) {
        const { ok: tokenOk, warning: tokenWarning } = await hasUsableSpotifyToken();
        if (!tokenOk) {
          return { status: "disconnected", me: null, warning: tokenWarning };
        }

        return { status: "connected", me: data as SpotifyMe, warning: null };
      }

      return { status: "disconnected", me: null, warning: null };
    } catch (error) {
      return {
        status: "disconnected",
        me: null,
        warning: isBlockedByClientError(error) ? BLOCKED_BY_CLIENT_WARNING : null,
      };
    }
  }, [authLoading, user]);

  const resolveSessionStateWithRetry = useCallback(
    async (options?: { shouldRetry?: boolean }): Promise<SpotifySessionState> => {
      const shouldRetry = options?.shouldRetry === true;
      const attempts = shouldRetry ? CONNECT_RETRY_DELAYS_MS.length + 1 : 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const next = await resolveSessionState();
        if (next.status === "connected") {
          return next;
        }

        if (attempt < attempts - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, CONNECT_RETRY_DELAYS_MS[attempt] ?? 0);
          });
        } else {
          return next;
        }
      }

      return { status: "disconnected", me: null, warning: null };
    },
    [resolveSessionState],
  );

  const refresh = useCallback(
    async (options?: { shouldRetry?: boolean; preserveCurrentWhileResolving?: boolean }) => {
      const shouldRetry = options?.shouldRetry === true;
      const preserveCurrentWhileResolving = options?.preserveCurrentWhileResolving === true;

      if (shouldRetry) {
        setState((prev) => {
          if (preserveCurrentWhileResolving && (prev.status === "connected" || prev.status === "connecting")) {
            return prev;
          }

          return { status: "loading", me: null, warning: prev.warning ?? null };
        });
      }

      const next = await resolveSessionStateWithRetry({ shouldRetry });
      setState(next);
      return next;
    },
    [resolveSessionStateWithRetry],
  );

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      if (authLoading) {
        setState({ status: "loading", me: null, warning: null });
        return;
      }

      const { hadConnectedMarker } = stripTransientOAuthParams();
      if (!user) {
        previousUserIdRef.current = null;
        setState({ status: "disconnected", me: null, warning: null });
        return;
      }

      const justLoggedIntoAppSession =
        previousUserIdRef.current !== undefined &&
        previousUserIdRef.current !== user.id &&
        previousUserIdRef.current === null;
      previousUserIdRef.current = user.id;

      if (hadConnectedMarker || justLoggedIntoAppSession) {
        setState({ status: "loading", me: null, warning: null });
      }

      const next = await resolveSessionStateWithRetry({
        shouldRetry: hadConnectedMarker || justLoggedIntoAppSession,
      });
      if (!alive) return;
      setState(next);
    };

    const handleSpotifyAuthRequired = () => {
      if (!alive) return;
      setState({ status: "disconnected", me: null, warning: null });
    };

    const handleHistoryOrCacheNavigation = () => {
      if (!alive) return;
      stripTransientOAuthParams();
      void refresh({ preserveCurrentWhileResolving: true });
    };

    void bootstrap();

    window.addEventListener(SPOTIFY_AUTH_REQUIRED_EVENT, handleSpotifyAuthRequired);
    window.addEventListener("popstate", handleHistoryOrCacheNavigation);
    window.addEventListener("pageshow", handleHistoryOrCacheNavigation);

    return () => {
      alive = false;
      window.removeEventListener(SPOTIFY_AUTH_REQUIRED_EVENT, handleSpotifyAuthRequired);
      window.removeEventListener("popstate", handleHistoryOrCacheNavigation);
      window.removeEventListener("pageshow", handleHistoryOrCacheNavigation);
    };
  }, [authLoading, refresh, resolveSessionStateWithRetry, stripTransientOAuthParams, user]);

  return { ...state, refresh };
}
