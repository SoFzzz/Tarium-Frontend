import type { ITrack } from "@/lib/player/types";

type SpotifyImage = {
  url: string;
  height?: number;
  width?: number;
};

type SpotifyArtist = {
  name: string;
};

type SpotifyAlbum = {
  name: string;
  images?: SpotifyImage[];
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  uri: string;
};

function toITrack(track: SpotifyTrack): ITrack {
  return {
    id: track.id,
    title: track.name,
    artist: track.artists[0]?.name ?? "Artista desconocido",
    album: track.album?.name,
    durationInSeconds: track.duration_ms / 1000,
    thumbnailUrl: track.album?.images?.[0]?.url ?? "/placeholder.png",
    audioUrl: track.uri,
    sourceType: "remote",
    source: "spotify",
  };
}

async function spotifyFetch<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    // No cache for user-scoped content.
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    // Spotify tends to return JSON errors, but don't assume.
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`Spotify API error (${res.status}): ${detail}`);
  }

  return (await res.json()) as T;
}

export async function searchTracks(query: string, token: string): Promise<ITrack[]> {
  const q = query.trim();
  if (!q) return [];

  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("type", "track");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");

  const data = await spotifyFetch<{ tracks?: { items?: SpotifyTrack[] } }>(
    url.toString(),
    token,
  );

  const items = data.tracks?.items;
  if (!Array.isArray(items)) return [];
  return items.map(toITrack);
}

export async function getTrack(id: string, token: string): Promise<ITrack> {
  const data = await spotifyFetch<SpotifyTrack>(
    `https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`,
    token,
  );
  return toITrack(data);
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { accessToken } = await refreshAccessTokenWithExpiresIn(refreshToken);
  return accessToken;
}

export async function refreshAccessTokenWithExpiresIn(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId) {
    throw new Error("Missing SPOTIFY_CLIENT_ID");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Spotify allows refresh with client_id, but Basic auth is also supported.
  // Prefer Basic when secret is configured.
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body,
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`Spotify token refresh failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { access_token?: string };
  const accessToken = data.access_token;
  const expiresIn = (data as { expires_in?: number }).expires_in;

  if (!accessToken) {
    throw new Error("Spotify token refresh returned no access_token");
  }

  return {
    accessToken,
    // Spotify returns expires_in (seconds). Fallback to 3600 if missing.
    expiresIn: typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 3600,
  };
}
