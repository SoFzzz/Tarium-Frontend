import type { MediaAdapter } from "@/lib/player/media-adapter";
import type { ITrack } from "@/lib/player/types";

import { HowlerAudioAdapter } from "@/lib/player/howler-audio-adapter";
import { SpotifyAudioAdapter } from "@/lib/player/spotify-audio-adapter";

type AdapterKind = "howler" | "spotify";

export class MultiSourceAudioAdapter implements MediaAdapter {
  private howler = new HowlerAudioAdapter();
  private spotify = new SpotifyAudioAdapter();
  private active: AdapterKind = "howler";

  private endedHandler: (() => void) | null = null;
  private timeUpdateHandler:
    | ((positionSeconds: number, durationSeconds: number) => void)
    | null = null;

  constructor() {
    this.howler.onEnded?.(() => {
      if (this.active !== "howler") return;
      this.endedHandler?.();
    });
    this.spotify.onEnded?.(() => {
      if (this.active !== "spotify") return;
      this.endedHandler?.();
    });

    this.howler.onTimeUpdate?.((p, d) => {
      if (this.active !== "howler") return;
      this.timeUpdateHandler?.(p, d);
    });
    this.spotify.onTimeUpdate?.((p, d) => {
      if (this.active !== "spotify") return;
      this.timeUpdateHandler?.(p, d);
    });
  }

  private isSpotifyTrack(track: ITrack): boolean {
    return (
      track.source === "spotify" ||
      (typeof track.audioUrl === "string" && track.audioUrl.startsWith("spotify:"))
    );
  }

  private assertTrackPayload(track: ITrack): void {
    if (this.isSpotifyTrack(track)) {
      if (!track.audioUrl || !track.audioUrl.startsWith("spotify:")) {
        throw new Error("Pista de Spotify invalida: falta URI de reproduccion.");
      }
      return;
    }

    const src = track.objectUrl ?? track.audioUrl;
    if (!src || src.trim().length === 0) {
      throw new Error("Pista invalida: falta URL de audio reproducible.");
    }
  }

  public async play(track: ITrack): Promise<void> {
    this.assertTrackPayload(track);
    const isSpotify = this.isSpotifyTrack(track);

    const incoming: AdapterKind = isSpotify ? "spotify" : "howler";

    // Stop the previous adapter when switching sources to prevent overlap
    if (incoming !== this.active) {
      const prev = this.active === "spotify" ? this.spotify : this.howler;
      try {
        await prev.pause();
        await prev.destroy?.();
      } catch {
        // Best-effort cleanup
      }
      this.active = incoming;
    }

    if (isSpotify) {
      await this.spotify.play(track);
      return;
    }

    await this.howler.play(track);
  }

  public async pause(): Promise<void> {
    if (this.active === "spotify") {
      await this.spotify.pause();
      return;
    }

    await this.howler.pause();
  }

  public setVolume(volume: number): void {
    // Apply to both to keep UX consistent when switching sources.
    this.howler.setVolume(volume);
    this.spotify.setVolume(volume);
  }

  public seekTo(seconds: number): void {
    if (this.active === "spotify") {
      this.spotify.seekTo?.(seconds);
      return;
    }

    this.howler.seekTo?.(seconds);
  }

  public onEnded(handler: () => void): void {
    this.endedHandler = handler;
  }

  public onTimeUpdate(
    handler: (positionSeconds: number, durationSeconds: number) => void,
  ): void {
    this.timeUpdateHandler = handler;
  }

  public async destroy(): Promise<void> {
    const activeAdapter = this.active === "spotify" ? this.spotify : this.howler;

    try {
      await activeAdapter.pause();
    } catch {
      // Best-effort cleanup
    }

    try {
      await activeAdapter.destroy?.();
    } catch {
      // Best-effort cleanup
    }

    this.active = "howler";
  }
}
