import type { ITrack } from "@/lib/player/types";

export type TrackSourcePrefix = "sp" | "ja" | "lo" | "yt" | "dz";

type ParsedTrackStorageId = {
  source: ITrack["source"] | null;
  rawId: string;
};

const SOURCE_BY_PREFIX: Record<TrackSourcePrefix, NonNullable<ITrack["source"]>> = {
  sp: "spotify",
  ja: "jamendo",
  lo: "local",
  yt: "youtube",
  dz: "deezer",
};

const PREFIX_BY_SOURCE: Partial<Record<NonNullable<ITrack["source"]>, TrackSourcePrefix>> = {
  spotify: "sp",
  jamendo: "ja",
  local: "lo",
  youtube: "yt",
  deezer: "dz",
};

export function toTrackStorageId(track: Pick<ITrack, "id" | "source" | "audioUrl" | "sourceType">): string {
  const parsedFromId = parseTrackStorageId(track.id);

  if (parsedFromId.source) {
    return `${PREFIX_BY_SOURCE[parsedFromId.source] ?? ""}:${parsedFromId.rawId}`.replace(/^:/, "");
  }

  const spotifyLike =
    track.source === "spotify" ||
    track.audioUrl?.startsWith("spotify:") === true;

  const source = spotifyLike ? "spotify" : track.source;
  const prefix = source ? PREFIX_BY_SOURCE[source] : undefined;

  if (!prefix) {
    return track.id;
  }

  const normalizedId =
    source === "spotify" && track.audioUrl?.startsWith("spotify:track:")
      ? track.audioUrl.replace("spotify:track:", "")
      : track.id;

  return `${prefix}:${normalizedId}`;
}

export function parseTrackStorageId(storedTrackId: string): ParsedTrackStorageId {
  const match = /^([a-z]{2}):(.*)$/i.exec(storedTrackId);
  if (!match) {
    if (storedTrackId.startsWith("spotify:track:")) {
      return {
        source: "spotify",
        rawId: storedTrackId.replace("spotify:track:", ""),
      };
    }

    return { source: null, rawId: storedTrackId };
  }

  const prefix = match[1]?.toLowerCase() as TrackSourcePrefix;
  const rawId = match[2] ?? storedTrackId;
  const source = SOURCE_BY_PREFIX[prefix] ?? null;

  return { source, rawId };
}

export function canonicalTrackIdentity(trackId: string): string {
  const parsed = parseTrackStorageId(trackId);

  if (parsed.source === "spotify") {
    return `spotify:${parsed.rawId}`;
  }

  if (!parsed.source && trackId.startsWith("spotify:track:")) {
    return `spotify:${trackId.replace("spotify:track:", "")}`;
  }

  if (!parsed.source && /^[A-Za-z0-9]{22}$/.test(trackId)) {
    return `spotify:${trackId}`;
  }

  if (parsed.source) {
    return `${parsed.source}:${parsed.rawId}`;
  }

  return `unknown:${parsed.rawId}`;
}
