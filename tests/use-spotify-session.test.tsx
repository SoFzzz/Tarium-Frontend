import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

    await waitFor(() => {
      expect(latest?.status).toBe("connected");
    });

    window.dispatchEvent(new Event("tarium:spotify-auth-required"));

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

    await waitFor(() => {
      expect(latest?.status).toBe("connected");
    });

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
    });

    const callsBeforePopstate = fetchMock.mock.calls.length;
    meConnected = false;
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(latest?.status).toBe("disconnected");
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforePopstate);
  });
});
