import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockOnAuthStateChange = vi.hoisted(() => vi.fn());
const mockSupabaseSignOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSupabaseSignOut,
    },
  },
}));

import { AuthProvider, useAuth } from "@/providers/AuthProvider";

function AuthHarness({
  onRender,
}: {
  onRender: (value: ReturnType<typeof useAuth>) => void;
}) {
  const value = useAuth();
  onRender(value);
  return null;
}

describe("AuthProvider signOut", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1", email: "user@test.com" } } },
      error: null,
    });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseSignOut.mockResolvedValue({ error: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("fase 3 - continua el cleanup local aunque Supabase falle", async () => {
    mockSupabaseSignOut.mockRejectedValue(new Error("network down"));

    const clearQueueListener = vi.fn();
    const spotifyListener = vi.fn();
    window.addEventListener("tarium:clear-queue", clearQueueListener);
    window.addEventListener("tarium:spotify-auth-required", spotifyListener);

    let latest: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthHarness
          onRender={(value) => {
            latest = value;
          }}
        />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(latest?.user?.id).toBe("user-1");
    });

    await act(async () => {
      await latest?.signOut();
    });

    await waitFor(() => {
      expect(latest?.user).toBeNull();
    });

    expect(fetch).toHaveBeenCalledWith("/api/spotify/logout", {
      method: "POST",
      credentials: "include",
    });
    expect(clearQueueListener).toHaveBeenCalled();
    expect(spotifyListener).toHaveBeenCalled();
    expect(latest?.error).toBe("Sesión local cerrada, pero algunos servicios no respondieron.");

    window.removeEventListener("tarium:clear-queue", clearQueueListener);
    window.removeEventListener("tarium:spotify-auth-required", spotifyListener);
  });

  it("fase 6 - limpia estado local aunque falle el logout de Spotify", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("spotify timeout"));

    const clearQueueListener = vi.fn();
    const spotifyListener = vi.fn();
    window.addEventListener("tarium:clear-queue", clearQueueListener);
    window.addEventListener("tarium:spotify-auth-required", spotifyListener);

    let latest: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthHarness
          onRender={(value) => {
            latest = value;
          }}
        />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(latest?.user?.id).toBe("user-1");
    });

    await act(async () => {
      await latest?.signOut();
    });

    await waitFor(() => {
      expect(latest?.user).toBeNull();
    });

    expect(mockSupabaseSignOut).toHaveBeenCalledTimes(1);
    expect(clearQueueListener).toHaveBeenCalledTimes(1);
    expect(
      clearQueueListener.mock.calls[0]?.[0] instanceof CustomEvent,
    ).toBe(true);
    expect(
      (clearQueueListener.mock.calls[0]?.[0] as CustomEvent).detail,
    ).toEqual({ userId: "user-1" });
    expect(spotifyListener).toHaveBeenCalledTimes(1);
    expect(latest?.error).toBe("Sesión local cerrada, pero algunos servicios no respondieron.");

    window.removeEventListener("tarium:clear-queue", clearQueueListener);
    window.removeEventListener("tarium:spotify-auth-required", spotifyListener);
  });

  it("fase 3 - revalida la sesion real en popstate", async () => {
    let sessionAvailable = true;
    mockGetSession.mockImplementation(async () => ({
      data: {
        session: sessionAvailable ? { user: { id: "user-1", email: "user@test.com" } } : null,
      },
      error: null,
    }));

    let latest: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthHarness
          onRender={(value) => {
            latest = value;
          }}
        />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(latest?.user?.id).toBe("user-1");
    });

    sessionAvailable = false;

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(latest?.user).toBeNull();
    });
  });

  it("fase 3 - revalida la sesion real en pageshow para bfcache", async () => {
    let sessionAvailable = true;
    mockGetSession.mockImplementation(async () => ({
      data: {
        session: sessionAvailable ? { user: { id: "user-1", email: "user@test.com" } } : null,
      },
      error: null,
    }));

    let latest: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthHarness
          onRender={(value) => {
            latest = value;
          }}
        />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(latest?.user?.id).toBe("user-1");
    });

    sessionAvailable = false;

    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });

    await waitFor(() => {
      expect(latest?.user).toBeNull();
    });
  });
});
