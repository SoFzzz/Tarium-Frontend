export type SpotifyConnectionStatus = "loading" | "connecting" | "disconnected" | "connected";
export type SpotifyAccessStage = "requires_auth" | "loading" | "connecting" | "ready" | "connected";

export function getSpotifyAccessStage({
  hasAppSession,
  spotifyStatus,
}: {
  hasAppSession: boolean;
  spotifyStatus: SpotifyConnectionStatus;
}): SpotifyAccessStage {
  if (!hasAppSession) return "requires_auth";
  if (spotifyStatus === "connected") return "connected";
  if (spotifyStatus === "connecting") return "connecting";
  if (spotifyStatus === "loading") return "loading";
  return "ready";
}
