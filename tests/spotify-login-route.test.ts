import { beforeEach, describe, expect, it, vi } from "vitest";

import { TARIUM_SESSION_COOKIE, TARIUM_SESSION_COOKIE_VALUE } from "@/lib/auth/session-marker";

const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

describe("/api/spotify/login", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    process.env.SPOTIFY_CLIENT_ID = "spotify-client-id";
    delete process.env.SPOTIFY_REDIRECT_URI;
  });

  it("redirecciona al inicio cuando no hay sesion base de Tarium", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });

    const { GET } = await import("@/app/api/spotify/login/route");
    const response = await GET(new Request("http://localhost:3000/api/spotify/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=error&reason=auth_required",
    );
  });

  it("inicia el flujo OAuth cuando la sesion base existe", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) =>
        name === TARIUM_SESSION_COOKIE
          ? { value: TARIUM_SESSION_COOKIE_VALUE }
          : undefined,
      ),
    });

    const { GET } = await import("@/app/api/spotify/login/route");
    const response = await GET(new Request("http://localhost:3000/api/spotify/login"));
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toContain("https://accounts.spotify.com/authorize");
    expect(location).toContain("client_id=spotify-client-id");
    expect(location).toContain("response_type=code");
  });
});
