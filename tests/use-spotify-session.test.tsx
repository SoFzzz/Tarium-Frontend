import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: useAuthMock,
}));

import { useSpotifySession } from "@/hooks/useSpotifySession";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function HookHarness({
  onRender,
}: {
  onRender: (value: ReturnType<typeof useSpotifySession>) => void;
}) {
  const value = useSpotifySession();
  onRender(value);
  return null;
}

describe("useSpotifySession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    useAuthMock.mockReturnValue({
      user: { id: "app-user" },
      authLoading: false,
    });
    window.history.replaceState({}, "", "/");
  });

  it("marca desconectado si /api/spotify/token responde 401", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/api/spotify/me")) {
          return response({ id: "sp-user", displayName: "Spotify User" });
        }
        if (url.includes("/api/spotify/token")) {
          return response({ error: "No conectado a Spotify" }, 401);
        }

        return response(null, 404);
      });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it("recibe evento global y pasa a desconectado", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/spotify/me")) {
        return response({ id: "sp-user", displayName: "Spotify User" });
      }
      if (url.includes("/api/spotify/token")) {
        return response({ accessToken: "token" });
      }

      return response(null, 404);
    });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect((latest as ReturnType<typeof useSpotifySession> | null)?.status).toBe("connected");

    await act(async () => {
      window.dispatchEvent(new Event("tarium:spotify-auth-required"));
    });

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });
  });

  it("limpia params OAuth transitorios y conserva estado conectado por sesion real", async () => {
    window.history.replaceState({}, "", "/?spotify=error&reason=state_mismatch");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/spotify/me")) {
        return response({ id: "sp-user", displayName: "Spotify User" });
      }
      if (url.includes("/api/spotify/token")) {
        return response({ accessToken: "token" });
      }

      return response(null, 404);
    });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect((latest as ReturnType<typeof useSpotifySession> | null)?.status).toBe("connected");

    expect(window.location.search).toBe("");
  });

  it("revalida sesion en popstate antes de mutar estado", async () => {
    let meConnected = true;

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/api/spotify/me")) {
          return response(
            meConnected ? { id: "sp-user", displayName: "Spotify User" } : null,
          );
        }
        if (url.includes("/api/spotify/token")) {
          return response(meConnected ? { accessToken: "token" } : { error: "No conectado" }, meConnected ? 200 : 401);
        }

        return response(null, 404);
      });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest?.status).toBe("connected");
    }, { timeout: 6000 });

    const callsBeforePopstate = fetchMock.mock.calls.length;
    meConnected = false;
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforePopstate);
  });

  it("fase 2 - reintenta con backoff controlado al volver del callback OAuth", async () => {
    window.history.replaceState({}, "", "/?spotify=connected");

    let meAttempts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/spotify/me")) {
        meAttempts += 1;
        if (meAttempts < 3) {
          return response(null, 200);
        }

        return response({ id: "sp-user", displayName: "Spotify User" });
      }
      if (url.includes("/api/spotify/token")) {
        return response({ accessToken: "token" });
      }

      return response(null, 404);
    });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />,
    );

    const initialStatus =
      (latest as ReturnType<typeof useSpotifySession> | null)?.status ?? null;
    expect(["loading", "connecting", null]).toContain(initialStatus);

    await waitFor(() => {
      expect(latest?.status).toBe("connected");
    }, { timeout: 6000 });

    expect(meAttempts).toBe(3);
    expect(window.location.search).toBe("");
  }, 10000);

  it("fase 3 - revalida sesion en pageshow para evitar UI cacheada", async () => {
    let meConnected = true;

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/api/spotify/me")) {
          return response(
            meConnected ? { id: "sp-user", displayName: "Spotify User" } : null,
          );
        }
        if (url.includes("/api/spotify/token")) {
          return response(
            meConnected ? { accessToken: "token" } : { error: "No conectado" },
            meConnected ? 200 : 401,
          );
        }

        return response(null, 404);
      });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest?.status).toBe("connected");
    });

    const callsBeforePageShow = fetchMock.mock.calls.length;
    meConnected = false;

    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforePageShow);
  });

  it("fase 6 - clasifica ERR_BLOCKED_BY_CLIENT como warning no bloqueante", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/spotify/me")) {
        throw new Error("net::ERR_BLOCKED_BY_CLIENT");
      }

      return response(null, 404);
    });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });

    expect((latest as ReturnType<typeof useSpotifySession> | null)?.warning).toBe(
      "Tu bloqueador puede interferir con Spotify; prueba desactivarlo para este sitio.",
    );
    expect(useAuthMock).toHaveBeenCalled();
  });

  it("fase 6 - clasifica ERR_BLOCKED_BY_CLIENT en /api/spotify/token como warning no bloqueante", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/spotify/me")) {
        return response({ id: "sp-user", displayName: "Spotify User" });
      }

      if (url.includes("/api/spotify/token")) {
        throw new Error("net::ERR_BLOCKED_BY_CLIENT");
      }

      return response(null, 404);
    });

    let latest: ReturnType<typeof useSpotifySession> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latest = value;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });

    expect((latest as ReturnType<typeof useSpotifySession> | null)?.warning).toBe(
      "Tu bloqueador puede interferir con Spotify; prueba desactivarlo para este sitio.",
    );
  });
});
