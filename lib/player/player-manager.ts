import type { MediaAdapter } from "./media-adapter";
import { DoublyLinkedList } from "./structures/doubly-linked-list";
import type { ITrack, PlaybackState, RepeatMode } from "./types";

export type HistoryListener = (track: ITrack) => void;

type Subscriber = (state: PlaybackState) => void;

export class PlayerManager {
  private playlist: DoublyLinkedList<ITrack>;
  private isPlaying = false;
  private loading = false;
  private volume = 72;
  private mediaAdapter: MediaAdapter | null;
  private subscribers = new Set<Subscriber>();
  private snapshot: PlaybackState;
  private historyListeners = new Set<HistoryListener>();
  private progressSeconds = 0;
  private durationSeconds = 0;
  private repeatMode: RepeatMode = "off";

  constructor(initialTracks: ITrack[] = [], mediaAdapter: MediaAdapter | null = null) {
    this.playlist = new DoublyLinkedList<ITrack>((track) => track.id);
    this.mediaAdapter = mediaAdapter;
    this.snapshot = this.buildSnapshot();

    if (initialTracks.length > 0) {
      this.loadQueue(initialTracks);
    }

    if (this.mediaAdapter?.onEnded) {
      this.mediaAdapter.onEnded(() => {
        void this.handleEnded();
      });
    }

    if (this.mediaAdapter?.onTimeUpdate) {
      this.mediaAdapter.onTimeUpdate((position, duration) => {
        this.progressSeconds = Math.max(0, Math.floor(position));
        this.durationSeconds = Math.max(0, Math.floor(duration));
        this.notify();
      });
    }
  }

  public loadQueue(tracks: ITrack[]): void {
    this.playlist.clear();

    for (const track of tracks) {
      this.playlist.insertAtEnd(track);
    }

    this.isPlaying = false;
    this.loading = false;
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.notify();
  }

  /** Reemplaza por completo la cola actual con la nueva lista. */
  public setQueue(tracks: ITrack[]): void {
    this.loadQueue(tracks);
  }

  public addTrack(track: ITrack): void {
    this.playlist.insertAtEnd(track);
    this.notify();
  }

  public addTrackNext(track: ITrack): void {
    const currentTrack = this.playlist.getCurrent();

    if (currentTrack === null) {
      this.playlist.insertAtStart(track);
      this.notify();
      return;
    }

    const queue = this.playlist.toArray();
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);

    if (currentIndex === -1) {
      this.playlist.insertAtEnd(track);
      this.notify();
      return;
    }

    this.playlist.insertAtPosition(currentIndex + 1, track);
    this.notify();
  }

  public removeTrack(id: string): ITrack | null {
    const removedTrack = this.playlist.removeById(id);

    if (removedTrack === null) {
      return null;
    }

    if (this.playlist.isEmpty()) {
      this.isPlaying = false;
      this.loading = false;
    }

    this.notify();
    return removedTrack;
  }

  public async play(): Promise<void> {
    const currentTrack = this.playlist.getCurrent();

    if (currentTrack === null) {
      return;
    }

    this.loading = true;
    this.notify();

    try {
      await this.mediaAdapter?.play(currentTrack);
      this.isPlaying = true;

      // Registrar en historial solo cuando realmente empieza a reproducirse.
      for (const listener of this.historyListeners) {
        listener(currentTrack);
      }
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  public async pause(): Promise<void> {
    await this.mediaAdapter?.pause();
    this.isPlaying = false;
    this.loading = false;
    this.notify();
  }

   /** Permite hacer seek en segundos sobre la pista actual. */
  public seek(seconds: number): void {
    if (!this.mediaAdapter?.seekTo) return;
    const clamped = Math.max(0, seconds);
    this.mediaAdapter.seekTo(clamped);
  }

  public async togglePlayPause(): Promise<void> {
    if (this.isPlaying) {
      await this.pause();
      return;
    }

    await this.play();
  }

  public async playById(id: string): Promise<ITrack | null> {
    const track = this.playlist.setCurrentById(id);

    if (track === null) {
      return null;
    }
    // Al cambiar de pista, reseteamos el progreso y la duración visibles
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.notify();

    await this.play();
    return track;
  }

  public async playNext(): Promise<ITrack | null> {
    const track = this.playlist.getNext();

    if (track === null) {
      return null;
    }
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.notify();

    await this.play();
    return track;
  }

  public async playPrevious(): Promise<ITrack | null> {
    const track = this.playlist.getPrevious();

    if (track === null) {
      return null;
    }
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.notify();

    await this.play();
    return track;
  }

  public setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.volume = clampedVolume;
    this.mediaAdapter?.setVolume(clampedVolume);
    this.notify();
  }

  public shuffle(): void {
    const queue = this.playlist.toArray();

    if (queue.length <= 1) {
      return;
    }

    const currentTrack = this.playlist.getCurrent();
    const shuffledQueue = [...queue];

    for (let index = shuffledQueue.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const currentItem = shuffledQueue[index];
      const randomItem = shuffledQueue[randomIndex];

      if (currentItem === undefined || randomItem === undefined) {
        continue;
      }

      shuffledQueue[index] = randomItem;
      shuffledQueue[randomIndex] = currentItem;
    }

    this.playlist.clear();

    for (const track of shuffledQueue) {
      this.playlist.insertAtEnd(track);
    }

    if (currentTrack !== null) {
      this.playlist.setCurrentById(currentTrack.id);
    }

    this.notify();
  }

  public cycleRepeatMode(): void {
    this.repeatMode = this.repeatMode === "off" ? "all" : this.repeatMode === "all" ? "one" : "off";
    this.notify();
  }

  public getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  public getState(): PlaybackState {
    return this.snapshot;
  }

  public subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);

    return () => {
      this.subscribers.delete(listener);
    };
  }

  /** Permite que un consumidor (hook de historial) se suscriba a reproducciones reales. */
  public onTrackPlay(listener: HistoryListener): () => void {
    this.historyListeners.add(listener);
    return () => {
      this.historyListeners.delete(listener);
    };
  }

  private notify(): void {
    this.snapshot = this.buildSnapshot();
    const snapshot = this.snapshot;

    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private buildSnapshot(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      loading: this.loading,
      volume: this.volume,
      repeatMode: this.repeatMode,
      currentTrack: this.playlist.getCurrent(),
      queue: this.playlist.toArray(),
      progressSeconds: this.progressSeconds,
      durationSeconds: this.durationSeconds,
      error: null,
      canPlay: true,
    };
  }

  private async handleEnded(): Promise<void> {
    const queue = this.playlist.toArray();
    const current = this.playlist.getCurrent();

    if (!current) {
      return;
    }

    const isLastTrack = queue.length > 0 && queue[queue.length - 1]?.id === current.id;

    if (this.repeatMode === "one") {
      await this.play();
      return;
    }

    if (this.repeatMode === "all" && isLastTrack) {
      const first = queue[0];
      if (!first) return;
      await this.playById(first.id);
      return;
    }

    await this.playNext();
  }
}
