import type { ITrack } from "./types";

export interface MediaAdapter {
  play(track: ITrack): Promise<void> | void;
  pause(): Promise<void> | void;
  setVolume(volume: number): void;
  seekTo?(seconds: number): void;

  /** Notifica cuando la pista actual termina de reproducirse. */
  onEnded?(handler: () => void): void;

  /** Notifica actualizaciones de tiempo de reproducción y duración en segundos. */
  onTimeUpdate?(handler: (positionSeconds: number, durationSeconds: number) => void): void;
}
