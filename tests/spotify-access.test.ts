import { describe, expect, it } from "vitest";

import { getSpotifyAccessStage } from "@/lib/auth/spotify-access";

describe("getSpotifyAccessStage", () => {
  it("bloquea Spotify cuando no existe sesion base de Tarium", () => {
    expect(
      getSpotifyAccessStage({
        hasAppSession: false,
        spotifyStatus: "disconnected",
      }),
    ).toBe("requires_auth");
  });

  it("habilita la conexion cuando existe sesion Tarium pero no Spotify", () => {
    expect(
      getSpotifyAccessStage({
        hasAppSession: true,
        spotifyStatus: "disconnected",
      }),
    ).toBe("ready");
  });

  it("expone el estado conectado cuando ambas sesiones existen", () => {
    expect(
      getSpotifyAccessStage({
        hasAppSession: true,
        spotifyStatus: "connected",
      }),
    ).toBe("connected");
  });
});
