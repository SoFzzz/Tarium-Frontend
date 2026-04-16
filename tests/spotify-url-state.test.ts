import { describe, expect, it } from "vitest";

import { sanitizeSpotifyUrlState } from "@/lib/auth/spotify-url-state";

describe("sanitizeSpotifyUrlState", () => {
  it("fase 4 - limpia params transitorios y normaliza rutas callback", () => {
    const result = sanitizeSpotifyUrlState(
      "http://localhost:3000/api/spotify/callback?spotify=connected&reason=ok#section",
    );

    expect(result.hadConnectedMarker).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.sanitizedUrl).toBe("http://localhost:3000/#section");
  });

  it("fase 4 - conserva params no transitorios fuera del callback", () => {
    const result = sanitizeSpotifyUrlState(
      "http://localhost:3000/search?q=radio&spotify=error&reason=state_mismatch",
    );

    expect(result.hadConnectedMarker).toBe(false);
    expect(result.changed).toBe(true);
    expect(result.sanitizedUrl).toBe("http://localhost:3000/search?q=radio");
  });
});
