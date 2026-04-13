export interface ITrack {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  durationInSeconds?: number;
  album?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  loading: boolean;
  volume: number;
  currentTrack: ITrack | null;
  queue: ITrack[];
}
