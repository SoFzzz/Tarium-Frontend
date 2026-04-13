import { Howl, Howler } from "howler";

import type { ITrack } from "./types";
import type { MediaAdapter } from "./media-adapter";

/**
 * Adaptador concreto basado en Howler para reproducir audio real en el navegador.
 * Usa `track.objectUrl` como fuente principal.
 */
export class HowlerAudioAdapter implements MediaAdapter {
  private currentHowl: Howl | null = null;
  private endedHandler: (() => void) | null = null;
  private timeUpdateHandler:
    | ((positionSeconds: number, durationSeconds: number) => void)
    | null = null;
  private timeUpdateIntervalId: number | null = null;

  public async play(track: ITrack): Promise<void> {
    const src = track.objectUrl;

    if (!src) {
      // Sin fuente real no hay nada que reproducir.
      return;
    }

    // Determinar extensión explícita para ayudar a Howler a elegir el decoder.
    const ext = track.fileName?.split(".").pop()?.toLowerCase() || "mp3";

    // Siempre limpiamos el howl anterior antes de crear uno nuevo.
    this.cleanupCurrentHowl();

    await new Promise<void>((resolve, reject) => {
      const howl = new Howl({
        src: [src],
        format: [ext],
        html5: true,
        onload: () => {
          this.currentHowl = howl;
          this.attachHowlEvents();
          howl.play();
          this.startTimeUpdates();
          resolve();
        },
        onloaderror: (_id, error) => {
          reject(error);
        },
      });
    });
  }

  public async pause(): Promise<void> {
    this.currentHowl?.pause();
    this.stopTimeUpdates();
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(100, volume));
    Howler.volume(clamped / 100);
  }

  public seekTo(seconds: number): void {
    if (!this.currentHowl) return;
    this.currentHowl.seek(seconds);
    this.emitTimeUpdate();
  }

  public onEnded(handler: () => void): void {
    this.endedHandler = handler;
  }

  public onTimeUpdate(
    handler: (positionSeconds: number, durationSeconds: number) => void,
  ): void {
    this.timeUpdateHandler = handler;
    this.startTimeUpdates();
  }

  private attachHowlEvents(): void {
    if (!this.currentHowl) return;

    this.currentHowl.off("end");
    this.currentHowl.on("end", () => {
      this.stopTimeUpdates();
      this.endedHandler?.();
    });
  }

  private startTimeUpdates(): void {
    if (!this.timeUpdateHandler || !this.currentHowl) return;

    this.stopTimeUpdates();

    const id = window.setInterval(() => {
      this.emitTimeUpdate();
    }, 250);

    this.timeUpdateIntervalId = id;
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateIntervalId !== null) {
      window.clearInterval(this.timeUpdateIntervalId);
      this.timeUpdateIntervalId = null;
    }
  }

  private emitTimeUpdate(): void {
    if (!this.currentHowl || !this.timeUpdateHandler) return;
    const position = this.currentHowl.seek() as number;
    const duration = this.currentHowl.duration();
    this.timeUpdateHandler(position, duration);
  }

  private cleanupCurrentHowl(): void {
    this.stopTimeUpdates();

    if (this.currentHowl) {
      this.currentHowl.off("end");
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  }
}
