export type SpotifyConnectionStatus = "loading" | "disconnected" | "connected";
export type SpotifyAccessStage = "requires_auth" | "loading" | "ready" | "connected";

export function getSpotifyAccessStage({
  hasAppSession,
  spotifyStatus,
}: {
  hasAppSession: boolean;
  spotifyStatus: SpotifyConnectionStatus;
}): SpotifyAccessStage {
  if (!hasAppSession) return "requires_auth";
  if (spotifyStatus === "connected") return "connected";
  if (spotifyStatus === "loading") return "loading";
  return "ready";
}
