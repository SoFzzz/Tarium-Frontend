import type { ITrack } from "@/lib/player/types";

const JAMENDO_BASE_URL = "https://api.jamendo.com/v3.0";

export interface JamendoArtist {
  id: string;
  name: string;
  image: string;
}

type JamendoTrackApi = {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  album_image?: string;
  audio?: string;
  duration?: number;
};

type JamendoArtistApi = {
  id?: string;
  name?: string;
  image?: string;
};

type JamendoResponse<T> = {
  results?: T[];
  headers?: unknown;
};

function getJamendoClientId(): string {
  // Jamendo is used only via server API routes.
  const id = process.env.JAMENDO_CLIENT_ID?.trim();
  if (!id) {
    throw new Error("Missing JAMENDO_CLIENT_ID");
  }
  return id;
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toITrack(track: JamendoTrackApi): ITrack | null {
  if (!track.id || !track.name) return null;

  // Howler adapter expects `objectUrl` for non-Spotify playback.
  // We reuse that field for Jamendo's direct MP3 URL.
  const audioSrc = track.audio;

  return {
    id: track.id,
    title: track.name,
    artist: track.artist_name ?? "Artista desconocido",
    album: track.album_name,
    thumbnailUrl: track.album_image ?? "/placeholder.png",
    durationInSeconds: typeof track.duration === "number" ? Math.floor(track.duration) : undefined,
    objectUrl: typeof audioSrc === "string" && audioSrc.length > 0 ? audioSrc : undefined,
    sourceType: "remote",
    source: "jamendo",
  };
}

async function jamendoFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const clientId = getJamendoClientId();

  const url = new URL(`${JAMENDO_BASE_URL}${path}`);
  url.searchParams.set("client_id", clientId);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const detail = (await safeJson<unknown>(res)) ?? (await res.text().catch(() => ""));
    throw new Error(`Jamendo API error (${res.status}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }

  return (await res.json()) as T;
}

export async function getTopTracks(
  limit = 20,
): Promise<{ results: ITrack[]; error?: string }> {
  try {
    const data = await jamendoFetch<JamendoResponse<JamendoTrackApi>>("/tracks/", {
      order: "popularity_total",
      include: "musicinfo",
      audioformat: "mp32",
      limit: String(limit),
    });

    const items = Array.isArray(data.results) ? data.results : [];
    const mapped = items.map(toITrack).filter((t): t is ITrack => t !== null);
    return { results: mapped };
  } catch (err) {
    return { results: [], error: err instanceof Error ? err.message : "jamendo_error" };
  }
}

export async function searchTracks(
  query: string,
  limit = 20,
): Promise<{ results: ITrack[]; error?: string }> {
  const q = query.trim();
  if (!q) return { results: [] };

  try {
    const data = await jamendoFetch<JamendoResponse<JamendoTrackApi>>("/tracks/", {
      search: q,
      include: "musicinfo",
      audioformat: "mp32",
      limit: String(limit),
    });

    const items = Array.isArray(data.results) ? data.results : [];
    const mapped = items.map(toITrack).filter((t): t is ITrack => t !== null);
    return { results: mapped };
  } catch (err) {
    return { results: [], error: err instanceof Error ? err.message : "jamendo_error" };
  }
}

export async function getTopArtists(
  limit = 10,
): Promise<{ results: JamendoArtist[]; error?: string }> {
  try {
    const data = await jamendoFetch<JamendoResponse<JamendoArtistApi>>("/artists/", {
      order: "popularity_total",
      limit: String(limit),
    });

    const items = Array.isArray(data.results) ? data.results : [];
    const mapped: JamendoArtist[] = items
      .map((a) => {
        if (!a.id || !a.name) return null;
        return {
          id: String(a.id),
          name: String(a.name),
          image: typeof a.image === "string" && a.image.trim().length > 0 ? a.image : "/placeholder.png",
        };
      })
      .filter((a): a is JamendoArtist => a !== null);

    return { results: mapped };
  } catch (err) {
    return { results: [], error: err instanceof Error ? err.message : "jamendo_error" };
  }
}

export async function getArtistTracks(
  artistId: string,
  limit = 10,
): Promise<{ results: ITrack[]; error?: string }> {
  const id = artistId.trim();
  if (!id) return { results: [] };

  try {
    const data = await jamendoFetch<JamendoResponse<JamendoTrackApi>>("/artists/tracks/", {
      id,
      audioformat: "mp32",
      limit: String(limit),
    });

    const items = Array.isArray(data.results) ? data.results : [];
    const mapped = items.map(toITrack).filter((t): t is ITrack => t !== null);
    return { results: mapped };
  } catch (err) {
    return { results: [], error: err instanceof Error ? err.message : "jamendo_error" };
  }
}
