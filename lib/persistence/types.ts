export type SyncMode = "guest" | "authenticated";

export interface PersistedPlaylistTrack {
  id: string;
  playlist_id: string;
  track_id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail_url: string;
  duration_seconds?: number;
  position: number;
  added_at: string;
}

export interface PersistedPlaylist {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  tracks: PersistedPlaylistTrack[];
}

export interface PersistedFavorite {
  track_id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail_url: string;
  duration_seconds?: number;
  created_at: string;
}

export interface PersistedHistoryEntry {
  track_id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail_url: string;
  duration_seconds?: number;
  play_count: number;
  last_played_at: string;
  created_at: string;
}

export interface PersistenceAdapter {
  mode: SyncMode;

  getPlaylists(): Promise<PersistedPlaylist[]>;
  savePlaylists(playlists: PersistedPlaylist[]): Promise<void>;

  getFavorites(): Promise<PersistedFavorite[]>;
  saveFavorites(favorites: PersistedFavorite[]): Promise<void>;

  getHistory(): Promise<PersistedHistoryEntry[]>;
  saveHistory(history: PersistedHistoryEntry[]): Promise<void>;
}
