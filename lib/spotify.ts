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
  id: string;
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
    id: `sp:${track.id}`,
    title: track.name,
    artist: track.artists[0]?.name ?? "Artista desconocido",
    album: track.album?.name,
    durationInSeconds: Math.round(track.duration_ms / 1000),
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

export interface IArtist {
  id: string;
  name: string;
  imageUrl: string;
  genres?: string[];
}

export async function getTopArtists(token: string, limit = 10): Promise<IArtist[]> {
  const url = `https://api.spotify.com/v1/me/top/artists?limit=${limit}`;
  const data = await spotifyFetch<{ items?: unknown[] }>(url, token);
  return (data.items || [])
    .map((item): IArtist | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : "";
      const name = typeof obj.name === "string" ? obj.name : "";

      const images = Array.isArray(obj.images) ? (obj.images as unknown[]) : [];
      const firstImage = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>) : null;
      const imageUrl = (firstImage && typeof firstImage.url === "string" ? firstImage.url : "") || "/placeholder.png";

      const genres = Array.isArray(obj.genres) ? (obj.genres as unknown[]).filter((g): g is string => typeof g === "string") : undefined;
      if (!id || !name) return null;
      return { id, name, imageUrl, genres };
    })
    .filter((a): a is IArtist => Boolean(a));
}

export async function getRecommendations(token: string, seedArtists: string[], limit = 10): Promise<ITrack[]> {
  const url = new URL("https://api.spotify.com/v1/recommendations");
  url.searchParams.set("limit", limit.toString());
  if (seedArtists.length > 0) {
    url.searchParams.set("seed_artists", seedArtists.slice(0, 5).join(","));
  }

  const data = await spotifyFetch<{ tracks?: SpotifyTrack[] }>(url.toString(), token);
  return (data.tracks || []).map(toITrack);
}

export async function getArtistTopTracks(token: string, artistId: string, market = "US"): Promise<ITrack[]> {
  const url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${market}`;
  const data = await spotifyFetch<{ tracks?: SpotifyTrack[] }>(url, token);
  return (data.tracks || []).map(toITrack);
}

// --- Block 5: Genres / Categories ---

export interface ICategory {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ISpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  tracksTotal: number;
}

export async function getCategories(token: string, limit = 30, locale = "es_ES"): Promise<ICategory[]> {
  const url = `https://api.spotify.com/v1/browse/categories?limit=${limit}&locale=${locale}`;
  const data = await spotifyFetch<{ categories?: { items?: unknown[] } }>(url, token);
  const items = data.categories?.items || [];
  return items
    .map((c): ICategory | null => {
      if (!c || typeof c !== "object") return null;
      const obj = c as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : "";
      const name = typeof obj.name === "string" ? obj.name : "";

      const icons = Array.isArray(obj.icons) ? (obj.icons as unknown[]) : [];
      const firstIcon = icons[0] && typeof icons[0] === "object" ? (icons[0] as Record<string, unknown>) : null;
      const imageUrl = (firstIcon && typeof firstIcon.url === "string" ? firstIcon.url : "") || "/placeholder.png";

      if (!id || !name) return null;
      return { id, name, imageUrl };
    })
    .filter((c): c is ICategory => Boolean(c));
}

export async function getCategoryPlaylists(token: string, categoryId: string, limit = 20): Promise<ISpotifyPlaylist[]> {
  const url = `https://api.spotify.com/v1/browse/categories/${categoryId}/playlists?limit=${limit}`;
  const data = await spotifyFetch<{ playlists?: { items?: unknown[] } }>(url, token);
  const items = data.playlists?.items || [];
  return items
    .map((p): ISpotifyPlaylist | null => {
      if (!p || typeof p !== "object") return null;
      const obj = p as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : "";
      const name = typeof obj.name === "string" ? obj.name : "";

      const images = Array.isArray(obj.images) ? (obj.images as unknown[]) : [];
      const firstImage = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>) : null;
      const imageUrl = (firstImage && typeof firstImage.url === "string" ? firstImage.url : "") || "/placeholder.png";

      const description = typeof obj.description === "string" ? obj.description : "";
      const tracksObj = obj.tracks && typeof obj.tracks === "object" ? (obj.tracks as Record<string, unknown>) : null;
      const tracksTotal = tracksObj && typeof tracksObj.total === "number" ? tracksObj.total : 0;

      if (!id || !name) return null;
      return { id, name, imageUrl, description, tracksTotal };
    })
    .filter((p): p is ISpotifyPlaylist => Boolean(p));
}

export async function getPlaylistTracks(token: string, playlistId: string, limit = 50): Promise<ITrack[]> {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`;
  const data = await spotifyFetch<{ items?: { track?: SpotifyTrack }[] }>(url, token);
  return (data.items || [])
    .map((i) => i.track)
    .filter((t): t is SpotifyTrack => !!t && !!t.id)
    .map(toITrack);
}

export async function getUserPlaylists(token: string, limit = 50): Promise<ISpotifyPlaylist[]> {
  const url = `https://api.spotify.com/v1/me/playlists?limit=${limit}`;
  const data = await spotifyFetch<{ items?: unknown[] }>(url, token);
  return (data.items || [])
    .map((p): ISpotifyPlaylist | null => {
      if (!p || typeof p !== "object") return null;
      const obj = p as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : "";
      const name = typeof obj.name === "string" ? obj.name : "";

      const images = Array.isArray(obj.images) ? (obj.images as unknown[]) : [];
      const firstImage = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>) : null;
      const imageUrl = (firstImage && typeof firstImage.url === "string" ? firstImage.url : "") || "/placeholder.png";

      const description = typeof obj.description === "string" ? obj.description : "";
      const tracksObj = obj.tracks && typeof obj.tracks === "object" ? (obj.tracks as Record<string, unknown>) : null;
      const tracksTotal = tracksObj && typeof tracksObj.total === "number" ? tracksObj.total : 0;

      if (!id || !name) return null;
      return { id, name, imageUrl, description, tracksTotal };
    })
    .filter((p): p is ISpotifyPlaylist => Boolean(p));
}
