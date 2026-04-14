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
    id: track.id,
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

export interface IAlbum {
  id: string;
  name: string;
  artist: string;
  imageUrl: string;
}

export async function getTopArtists(token: string, limit = 10): Promise<IArtist[]> {
  const url = `https://api.spotify.com/v1/me/top/artists?limit=${limit}`;
  const data = await spotifyFetch<{ items?: any[] }>(url, token);
  return (data.items || []).map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.images?.[0]?.url || "/placeholder.png",
    genres: item.genres,
  }));
}

export async function getRecentlyPlayedAlbums(token: string, limit = 50): Promise<IAlbum[]> {
  const url = `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`;
  const data = await spotifyFetch<{ items?: { track?: SpotifyTrack }[] }>(url, token);
  
  const albumsMap = new Map<string, IAlbum>();
  for (const item of (data.items || [])) {
    const track = item.track;
    if (track?.album?.id && !albumsMap.has(track.album.id)) {
      albumsMap.set(track.album.id, {
        id: track.album.id,
        name: track.album.name,
        artist: track.artists?.[0]?.name || "Artista desconocido",
        imageUrl: track.album.images?.[0]?.url || "/placeholder.png",
      });
    }
  }
  return Array.from(albumsMap.values()).slice(0, 10);
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

export async function getArtistAlbums(token: string, artistId: string, limit = 20): Promise<IAlbum[]> {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=${limit}`;
  const data = await spotifyFetch<{ items?: any[] }>(url, token);
  const seen = new Set<string>();
  const albums: IAlbum[] = [];
  for (const item of data.items || []) {
    const name = (item.name as string).toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    albums.push({
      id: item.id,
      name: item.name,
      artist: item.artists?.[0]?.name || "Artista desconocido",
      imageUrl: item.images?.[0]?.url || "/placeholder.png",
    });
  }
  return albums;
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
  const data = await spotifyFetch<{ categories?: { items?: any[] } }>(url, token);
  return (data.categories?.items || []).map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.icons?.[0]?.url || "/placeholder.png",
  }));
}

export async function getCategoryPlaylists(token: string, categoryId: string, limit = 20): Promise<ISpotifyPlaylist[]> {
  const url = `https://api.spotify.com/v1/browse/categories/${categoryId}/playlists?limit=${limit}`;
  const data = await spotifyFetch<{ playlists?: { items?: any[] } }>(url, token);
  return (data.playlists?.items || []).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.images?.[0]?.url || "/placeholder.png",
    description: p.description || "",
    tracksTotal: p.tracks?.total || 0,
  }));
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
  const data = await spotifyFetch<{ items?: any[] }>(url, token);
  return (data.items || []).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.images?.[0]?.url || "/placeholder.png",
    description: p.description || "",
    tracksTotal: p.tracks?.total || 0,
  }));
}

