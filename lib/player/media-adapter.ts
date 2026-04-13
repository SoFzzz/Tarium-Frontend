import type { ITrack } from "./types";

export interface MediaAdapter {
  play(track: ITrack): Promise<void> | void;
  pause(): Promise<void> | void;
  setVolume(volume: number): void;
  seekTo?(seconds: number): void;
}

export class BrowserMockMediaAdapter implements MediaAdapter {
  private volume = 100;

  public async play(): Promise<void> {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 240);
    });
  }

  public async pause(): Promise<void> {
    await Promise.resolve();
  }

  public setVolume(volume: number): void {
    this.volume = volume;
  }

  public getVolume(): number {
    return this.volume;
  }
}
