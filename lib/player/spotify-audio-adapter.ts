import type { MediaAdapter } from "@/lib/player/media-adapter";
import type { ITrack } from "@/lib/player/types";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

type SpotifyPlaybackState = {
  position: number;
  duration: number;
  paused: boolean;
  track_window: {
    current_track?: {
      uri?: string;
      id?: string;
    };
  };
};

type SpotifyError = { message: string };

type SpotifyPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;

  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;

  getCurrentState: () => Promise<SpotifyPlaybackState | null>;

  addListener: (event: string, cb: (...args: unknown[]) => void) => boolean;
  removeListener: (event: string, cb?: (...args: unknown[]) => void) => boolean;
};

const SPOTIFY_AUTH_REQUIRED_EVENT = "tarium:spotify-auth-required";
const AUTH_FAILURE_COOLDOWN_MS = 10000;

function notifySpotifyAuthRequired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SPOTIFY_AUTH_REQUIRED_EVENT));
}

class SpotifyPlaybackAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyPlaybackAuthError";
  }
}

async function defaultGetAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) {
      notifySpotifyAuthRequired();
      throw new SpotifyPlaybackAuthError("Spotify requiere reconexion");
    }
    throw new Error("No conectado a Spotify");
  }
  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) throw new Error("No access token");
  return data.accessToken;
}

async function waitForSpotifySdkReady(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.Spotify?.Player) return;

  await new Promise<void>((resolve) => {
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      resolve();
    };
  });
}

export class SpotifyAudioAdapter implements MediaAdapter {
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;

  private endedHandler: (() => void) | null = null;
  private timeUpdateHandler:
    | ((positionSeconds: number, durationSeconds: number) => void)
    | null = null;
  private pollTimeoutId: number | null = null;

  private readyPromise: Promise<void> | null = null;
  private getAccessToken: () => Promise<string>;
  private authFailureUntil = 0;

  // Ended detection state
  private lastPositionMs = 0;
  private lastPaused: boolean | null = null;
  private hadProgressSincePlay = false;
  private lastTrackUri: string | null = null;

  constructor(getAccessToken: () => Promise<string> = defaultGetAccessToken) {
    this.getAccessToken = getAccessToken;
  }

  private setAuthFailure(message?: string): void {
    this.authFailureUntil = Date.now() + AUTH_FAILURE_COOLDOWN_MS;
    if (message) {
      console.warn("Spotify auth/session issue:", message);
    }
    notifySpotifyAuthRequired();
  }

  private isAuthFailureActive(): boolean {
    return Date.now() < this.authFailureUntil;
  }

  public async play(track: ITrack): Promise<void> {
    const uri = track.audioUrl;
    if (!uri || !uri.startsWith("spotify:")) {
      // Not a Spotify track.
      return;
    }

    await this.ensureReady();

    // If it's the same track and we were paused, resume via the SDK.
    if (this.lastTrackUri === uri && this.lastPaused === true) {
      await this.player?.resume();
      this.startPolling();
      return;
    }

    const token = await this.getAccessToken();
    const deviceId = this.deviceId;
    if (!deviceId) throw new Error("Spotify device not ready");

    const url = new URL("https://api.spotify.com/v1/me/player/play");
    url.searchParams.set("device_id", deviceId);

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Spotify play failed (${res.status}): ${text}`);
    }

    this.lastTrackUri = uri;
    this.hadProgressSincePlay = false;
    this.lastPositionMs = 0;
    this.lastPaused = false;
    this.startPolling();
  }

  public async pause(): Promise<void> {
    await this.ensurePlayer();
    await this.player?.pause();
    this.lastPaused = true;
    // When paused, avoid keeping a tight polling loop alive.
    this.stopPolling();
  }

  public setVolume(volume: number): void {
    void (async () => {
      await this.ensurePlayer();
      const clamped = Math.max(0, Math.min(100, volume));
      await this.player?.setVolume(clamped / 100);
    })();
  }

  public seekTo(seconds: number): void {
    void (async () => {
      await this.ensurePlayer();
      const ms = Math.max(0, Math.floor(seconds * 1000));
      await this.player?.seek(ms);
    })();
  }

  public onEnded(handler: () => void): void {
    this.endedHandler = handler;
  }

  public onTimeUpdate(
    handler: (positionSeconds: number, durationSeconds: number) => void,
  ): void {
    this.timeUpdateHandler = handler;
    this.startPolling();
  }

  private async ensureReady(): Promise<void> {
    if (this.isAuthFailureActive()) {
      throw new SpotifyPlaybackAuthError("Spotify requiere reconexion");
    }

    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await this.ensurePlayer();
        await waitForSpotifySdkReady();
        await this.connectPlayer();
      })();

      this.readyPromise = this.readyPromise.catch((err) => {
        this.readyPromise = null;
        throw err;
      });
    }
    await this.readyPromise;
  }

  private async ensurePlayer(): Promise<void> {
    if (this.player) return;
    await waitForSpotifySdkReady();

    const PlayerCtor = window.Spotify?.Player;
    if (!PlayerCtor) {
      throw new Error("Spotify Web Playback SDK not loaded");
    }

    const player = new PlayerCtor({
      name: "Tarium",
      getOAuthToken: async (cb) => {
        try {
          const token = await this.getAccessToken();
          cb(token);
        } catch {
          // If token fetch fails, call back with empty token.
          cb("");
        }
      },
      volume: 0.72,
    });

    player.addListener("ready", (payload: unknown) => {
      const deviceId =
        payload && typeof payload === "object"
          ? (payload as { device_id?: unknown }).device_id
          : null;
      if (typeof deviceId === "string") {
        this.deviceId = deviceId;
      }
    });
    player.addListener("not_ready", () => {
      this.deviceId = null;
    });

    const logError = (label: string) => (e: unknown) => {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as SpotifyError).message)
          : String(e);
      console.error(`Spotify SDK ${label}:`, msg);

      if (label === "authentication_error") {
        this.setAuthFailure(msg);
      }
    };
    player.addListener("initialization_error", logError("initialization_error"));
    player.addListener("authentication_error", logError("authentication_error"));
    player.addListener("account_error", logError("account_error"));
    player.addListener("playback_error", logError("playback_error"));

    this.player = player;
  }

  private async connectPlayer(): Promise<void> {
    if (!this.player) return;
    const ok = await this.player.connect();
    if (!ok) {
      this.setAuthFailure("connect failed");
      throw new SpotifyPlaybackAuthError("Spotify Player connect failed");
    }

    // Wait for device id.
    const start = Date.now();
    while (!this.deviceId) {
      if (Date.now() - start > 5000) {
        throw new Error("Spotify device id timeout");
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private startPolling(): void {
    if (!this.player) return;
    if (!this.timeUpdateHandler && !this.endedHandler) return;

    if (this.pollTimeoutId !== null) return;
    this.scheduleNextPoll(0);
  }

  private stopPolling(): void {
    if (this.pollTimeoutId !== null) {
      window.clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.pollTimeoutId !== null) return;
    this.pollTimeoutId = window.setTimeout(() => {
      this.pollTimeoutId = null;
      void this.pollLoop();
    }, delayMs);
  }

  private async pollLoop(): Promise<void> {
    if (!this.player) return;
    if (!this.timeUpdateHandler && !this.endedHandler) return;

    let paused = this.lastPaused === true;
    try {
      paused = await this.pollOnce();
    } catch {
      // Best-effort: if polling fails transiently, slow down.
      this.scheduleNextPoll(1500);
      return;
    }

    // If paused, poll less frequently to reduce load.
    this.scheduleNextPoll(paused ? 1500 : 500);
  }

  private async pollOnce(): Promise<boolean> {
    if (!this.player) return true;
    const state = await this.player.getCurrentState();
    if (!state) return this.lastPaused === true;

    const positionSeconds = Math.max(0, Math.floor(state.position / 1000));
    const durationSeconds = Math.max(0, Math.floor(state.duration / 1000));

    if (this.timeUpdateHandler) {
      this.timeUpdateHandler(positionSeconds, durationSeconds);
    }

    const uri = state.track_window?.current_track?.uri ?? null;
    if (uri && this.lastTrackUri !== uri) {
      // Track changed externally.
      this.lastTrackUri = uri;
      this.hadProgressSincePlay = false;
      this.lastPositionMs = 0;
      this.lastPaused = state.paused;
      return state.paused;
    }

    if (state.position > 1000) {
      this.hadProgressSincePlay = true;
    }

    const ended =
      this.hadProgressSincePlay &&
      this.lastPaused === false &&
      state.paused === true &&
      state.position === 0;

    this.lastPaused = state.paused;
    this.lastPositionMs = state.position;

    if (ended) {
      this.hadProgressSincePlay = false;
      this.stopPolling();
      this.endedHandler?.();
    }

    return state.paused;
  }
  public async destroy(): Promise<void> {
    this.stopPolling();
    try {
      await this.player?.pause();
    } catch {
      // Ignore errors when pausing during destroy
    }
    this.lastTrackUri = null;
    this.hadProgressSincePlay = false;
    this.lastPaused = null;
    this.lastPositionMs = 0;
  }
}
