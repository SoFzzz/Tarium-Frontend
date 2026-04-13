export type MetadataStatus = "native" | "enriched" | "missing";

// LocalTrack según el plan, compatible con el modelo anterior.
export interface LocalTrack {
  id: string;
  fileName: string;
  // Referencia al File original solo en memoria.
  file: File;
  objectUrl: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  artworkUrl: string | null;
  sourceType: "local";
  metadataStatus: MetadataStatus;
}

// ITrack se mantiene como tipo que usa el reproductor/cola.
// Para tracks locales, se rellenan los campos desde LocalTrack.
export interface ITrack {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  durationInSeconds?: number;
  album?: string;
  // Para fuentes locales podemos conservar el nombre de archivo para hints de formato.
  fileName?: string;
  // Fuente local real del audio.
  objectUrl?: string;
  sourceType?: "local" | "remote";
}

export interface PlaybackState {
  isPlaying: boolean;
  loading: boolean;
  volume: number;
  currentTrack: ITrack | null;
  queue: ITrack[];
  progressSeconds: number;
  durationSeconds: number;
  error: string | null;
  canPlay: boolean;
}

export interface YouTubeSearchResult {
  youtubeId: string;
  title: string;
  artistOrChannel: string;
  thumbnailUrl: string;
  durationSeconds?: number;
}

export interface EnrichedMetadata {
  title: string;
  artist: string;
  thumbnailUrl: string;
  source: "youtube-search" | "native";
}

/**
 * Conversión explícita de LocalTrack (biblioteca local) al tipo ITrack usado por el reproductor.
 */
export function mapLocalTrackToITrack(local: LocalTrack): ITrack {
  return {
    id: local.id,
    title: local.title,
    artist: local.artist,
    album: local.album,
    durationInSeconds: local.durationSeconds,
    thumbnailUrl: local.artworkUrl ?? "/images/track-placeholder.png",
    fileName: local.fileName,
    objectUrl: local.objectUrl,
    sourceType: "local",
  };
}
