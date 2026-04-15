import type { ITrack } from "@/lib/player/types";

const TRACK_METADATA_KEY = "tarium.track-metadata.v1";

type CachedTrackMetadata = Pick<
  ITrack,
  "id" | "audioUrl" | "objectUrl" | "fileName" | "source" | "sourceType" | "album"
>;

function isSpotifyId(id: string): boolean {
  return /^[A-Za-z0-9]{22}$/.test(id);
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCache(): Record<string, CachedTrackMetadata> {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(TRACK_METADATA_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, CachedTrackMetadata>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedTrackMetadata>): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(TRACK_METADATA_KEY, JSON.stringify(cache));
  } catch {
    // Best-effort cache.
  }
}

export function rememberTrackPayload(track: ITrack): void {
  if (!track.id) return;

  const cache = readCache();
  cache[track.id] = {
    id: track.id,
    audioUrl: track.audioUrl,
    objectUrl: track.objectUrl,
    fileName: track.fileName,
    source: track.source,
    sourceType: track.sourceType,
    album: track.album,
  };
  writeCache(cache);
}

export function hydrateTrackPayload(track: ITrack): ITrack {
  const cache = readCache();
  const cached = cache[track.id];
  const merged: ITrack = {
    ...cached,
    ...track,
    audioUrl: track.audioUrl ?? cached?.audioUrl,
    objectUrl: track.objectUrl ?? cached?.objectUrl,
    fileName: track.fileName ?? cached?.fileName,
    source: track.source ?? cached?.source,
    sourceType: track.sourceType ?? cached?.sourceType,
    album: track.album ?? cached?.album,
  };

  const looksSpotify =
    merged.source === "spotify" ||
    merged.audioUrl?.startsWith("spotify:") === true ||
    isSpotifyId(merged.id);

  if (looksSpotify) {
    const spotifyId = merged.audioUrl?.startsWith("spotify:track:")
      ? merged.audioUrl.replace("spotify:track:", "")
      : merged.id;

    return {
      ...merged,
      id: spotifyId,
      source: "spotify",
      sourceType: "remote",
      audioUrl: `spotify:track:${spotifyId}`,
    };
  }

  if (!merged.source) {
    if (merged.sourceType === "local" || merged.objectUrl?.startsWith("blob:")) {
      return {
        ...merged,
        source: "local",
        sourceType: "local",
      };
    }

    if (merged.objectUrl || merged.audioUrl) {
      return {
        ...merged,
        source: "jamendo",
        sourceType: "remote",
      };
    }
  }

  return merged;
}
