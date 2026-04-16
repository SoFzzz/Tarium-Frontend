import type { MediaAdapter } from "./media-adapter";
import { DoublyLinkedList } from "./structures/doubly-linked-list";
import { canonicalTrackIdentity } from "@/lib/player/track-key";

import type { ITrack, PlaybackState, RepeatMode } from "./types";

type Subscriber = (state: PlaybackState) => void;

export class PlayerManager {
  private playlist: DoublyLinkedList<ITrack>;
  private isPlaying = false;
  private loading = false;
  private volume = 72;
  private mediaAdapter: MediaAdapter | null;
  private subscribers = new Set<Subscriber>();
  private snapshot: PlaybackState;
  private progressSeconds = 0;
  private durationSeconds = 0;
  private repeatMode: RepeatMode = "off";
  private error: string | null = null;
  private queueItemIdCounter = 0;

  constructor(initialTracks: ITrack[] = [], mediaAdapter: MediaAdapter | null = null) {
    this.playlist = new DoublyLinkedList<ITrack>((track) => this.getQueueItemId(track));
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
      this.playlist.insertAtEnd(this.ensureQueueIdentity(track));
    }

    this.isPlaying = false;
    this.loading = false;
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.error = null;
    this.notify();
  }

  public restoreQueueWithoutCurrent(tracks: ITrack[]): void {
    this.playlist.clear();

    for (const track of tracks) {
      this.playlist.insertAtEnd(this.ensureQueueIdentity(track));
    }

    this.playlist.clearCurrent();
    this.isPlaying = false;
    this.loading = false;
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.error = null;
    this.notify();
  }

  public async stopAndClear(): Promise<void> {
    await this.destroyAdapter();
    this.playlist.clear();
    this.isPlaying = false;
    this.loading = false;
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.error = null;
    this.notify();
  }

  /** Reemplaza por completo la cola actual con la nueva lista. */
  public setQueue(tracks: ITrack[]): void {
    const currentQueueItemId = this.playlist.getCurrent()?.queueItemId ?? null;
    const wasPlaying = this.isPlaying;
    const wasLoading = this.loading;
    const prevProgressSeconds = this.progressSeconds;
    const prevDurationSeconds = this.durationSeconds;

    this.playlist.clear();

    for (const track of tracks) {
      this.playlist.insertAtEnd(this.ensureQueueIdentity(track));
    }

    // Si habia un track actual, mantenerlo como current para no romper la reproduccion en curso.
    if (currentQueueItemId) {
      this.playlist.setCurrentById(currentQueueItemId);
    }

    // Reordenar no debe resetear el estado de reproduccion ni el progreso visible.
    this.isPlaying = wasPlaying;
    this.loading = wasLoading;
    this.progressSeconds = prevProgressSeconds;
    this.durationSeconds = prevDurationSeconds;
    this.error = null;
    this.notify();
  }

  public addTrack(track: ITrack): ITrack {
    const existingByQueueItemId = this.findExactQueueInjection(track);
    if (existingByQueueItemId) {
      this.error = null;
      return existingByQueueItemId;
    }

    const rescued = this.rescueInvalidDuplicate(track);
    if (rescued) {
      this.error = null;
      return rescued;
    }

    const withIdentity = this.ensureQueueIdentity(track);
    this.playlist.insertAtEnd(withIdentity);
    this.error = null;
    this.notify();
    return withIdentity;
  }

  public addTrackNext(track: ITrack): ITrack {
    const existingByQueueItemId = this.findExactQueueInjection(track);
    if (existingByQueueItemId) {
      this.error = null;
      return existingByQueueItemId;
    }

    const rescued = this.rescueInvalidDuplicate(track);
    if (rescued) {
      this.error = null;
      return rescued;
    }

    const withIdentity = this.ensureQueueIdentity(track);
    const currentTrack = this.playlist.getCurrent();

    if (currentTrack === null) {
      this.playlist.insertAtStart(withIdentity);
      this.error = null;
      this.notify();
      return withIdentity;
    }

    const queue = this.playlist.toArray();
    const currentIdentity = currentTrack.queueItemId ?? currentTrack.id;
    const currentIndex = queue.findIndex(
      (item) => (item.queueItemId ?? item.id) === currentIdentity,
    );

    if (currentIndex === -1) {
      this.playlist.insertAtEnd(withIdentity);
      this.error = null;
      this.notify();
      return withIdentity;
    }

    this.playlist.insertAtPosition(currentIndex + 1, withIdentity);
    this.error = null;
    this.notify();
    return withIdentity;
  }

  public removeTrack(id: string, by: "queueItemId" | "trackId" = "trackId"): ITrack | null {
    const targetQueueItemId = by === "queueItemId" ? id : this.findQueueItemIdByTrackId(id);

    if (!targetQueueItemId) {
      return null;
    }

    const currentTrack = this.playlist.getCurrent();
    const currentQueueItemId = currentTrack?.queueItemId ?? currentTrack?.id ?? null;
    const removingCurrentTrack = currentQueueItemId === targetQueueItemId;
    const wasPlaying = this.isPlaying;

    const removedTrack = this.playlist.removeById(targetQueueItemId);

    if (removedTrack === null) {
      return null;
    }

    if (this.playlist.isEmpty()) {
      this.isPlaying = false;
      this.loading = false;
      this.progressSeconds = 0;
      this.durationSeconds = 0;
    }

    if (removingCurrentTrack) {
      this.safePauseAdapter();
      this.progressSeconds = 0;
      this.durationSeconds = 0;
      this.isPlaying = false;
      this.loading = false;

      const nextCandidate = this.playlist.getCurrent();
      if (wasPlaying && nextCandidate) {
        void this.play().then(() => {
          if (this.error && this.playlist.size() > 1) {
            void this.playNext();
          }
        });
      }
    }

    this.error = null;

    this.notify();
    return removedTrack;
  }

  public async play(): Promise<void> {
    const currentTrack = this.playlist.getCurrent();

    if (currentTrack === null) {
      return;
    }

    const invalidReason = this.getInvalidTrackReason(currentTrack);
    if (invalidReason) {
      this.isPlaying = false;
      this.loading = false;
      this.error = invalidReason;
      this.notify();
      return;
    }

    this.loading = true;
    this.error = null;
    this.notify();

    try {
      await this.mediaAdapter?.play(currentTrack);
      this.isPlaying = true;
    } catch (error) {
      this.isPlaying = false;
      const message = error instanceof Error ? error.message : "";
      if (
        currentTrack.source === "local" ||
        currentTrack.sourceType === "local" ||
        message.includes("archivo local") ||
        message.includes("blob")
      ) {
        this.error = "No se pudo reproducir este archivo local. Vuelve a importarlo.";
      } else {
        this.error = "No se pudo reproducir el track seleccionado.";
      }
      return;
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  public async pause(): Promise<void> {
    this.loading = true;
    this.notify();

    try {
      await this.mediaAdapter?.pause();
      this.isPlaying = false;
      this.error = null;
    } catch {
      this.error = "No se pudo pausar la reproduccion.";
      return;
    } finally {
      this.loading = false;
      this.notify();
    }
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
    const previous = this.playlist.getCurrent();
    const targetQueueItemId = this.findQueueItemIdByTrackId(id);

    if (!targetQueueItemId) {
      return null;
    }

    const track = this.playlist.setCurrentById(targetQueueItemId);

    if (track === null) {
      return null;
    }
    // Al cambiar de pista, reseteamos el progreso y la duración visibles
    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.notify();

    try {
      await this.play();
    } catch {
      // play() ya no lanza para errores esperables.
    }

    if (this.error && previous?.queueItemId) {
      this.playlist.setCurrentById(previous.queueItemId);
      this.progressSeconds = 0;
      this.durationSeconds = 0;
      this.notify();
      return null;
    }

    return track;
  }

  public async playByQueueItemId(queueItemId: string): Promise<ITrack | null> {
    const previous = this.playlist.getCurrent();
    const track = this.playlist.setCurrentById(queueItemId);

    if (track === null) {
      return null;
    }

    this.progressSeconds = 0;
    this.durationSeconds = 0;
    this.notify();

    try {
      await this.play();
    } catch {
      // play() ya no lanza para errores esperables.
    }

    if (this.error && previous?.queueItemId) {
      this.playlist.setCurrentById(previous.queueItemId);
      this.progressSeconds = 0;
      this.durationSeconds = 0;
      this.notify();
      return null;
    }

    return track;
  }

  public addToQueue(track: ITrack, _origin?: string): ITrack {
    return this.addTrack(track);
  }

  public async playNow(track: ITrack, _origin?: string): Promise<ITrack | null> {
    const inserted = this.addTrackNext(track);
    const queueItemId = inserted.queueItemId ?? inserted.id;
    return this.playByQueueItemId(queueItemId);
  }

  public async playQueueItem(queueItemId: string): Promise<ITrack | null> {
    return this.playByQueueItemId(queueItemId);
  }

  public async playNext(): Promise<ITrack | null> {
    return this.playByDirection("next");
  }

  public async playPrevious(): Promise<ITrack | null> {
    return this.playByDirection("previous");
  }

  public setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.volume = clampedVolume;
    this.mediaAdapter?.setVolume(clampedVolume);
    this.error = null;
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
      const currentQueueItemId = currentTrack.queueItemId;
      if (currentQueueItemId) {
        this.playlist.setCurrentById(currentQueueItemId);
      } else {
        this.playlist.setCurrentById(this.getQueueItemId(currentTrack));
      }
    }

    this.error = null;
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
      error: this.error,
      canPlay: true,
    };
  }

  private ensureQueueIdentity(track: ITrack): ITrack {
    if (track.queueItemId && track.queueItemId.length > 0) {
      return track;
    }

    this.queueItemIdCounter += 1;
    return {
      ...track,
      queueItemId: `${track.id}::${this.queueItemIdCounter}`,
    };
  }

  private getQueueItemId(track: ITrack): string {
    return track.queueItemId ?? track.id;
  }

  private findQueueItemIdByTrackId(trackId: string): string | null {
    const currentTrack = this.playlist.getCurrent();
    if (currentTrack && currentTrack.id === trackId) {
      return currentTrack.queueItemId ?? currentTrack.id;
    }

    const queue = this.playlist.toArray();
    const track = queue.find((item) => item.id === trackId);
    if (!track) return null;
    return track.queueItemId ?? track.id;
  }

  private async handleEnded(): Promise<void> {
    const queue = this.playlist.toArray();
    const current = this.playlist.getCurrent();

    if (!current) {
      return;
    }

    const isLastTrack =
      queue.length > 0 &&
      (queue[queue.length - 1]?.queueItemId ?? queue[queue.length - 1]?.id) ===
        (current.queueItemId ?? current.id);

    if (this.repeatMode === "one") {
      await this.play();
      return;
    }

    if (this.repeatMode === "all" && isLastTrack) {
      const first = queue[0];
      if (!first) return;
      await this.playByQueueItemId(first.queueItemId ?? first.id);
      return;
    }

    const next = await this.playNext();
    if (!next) {
      this.isPlaying = false;
      this.loading = false;
      this.notify();
    }
  }

  private getInvalidTrackReason(track: ITrack): string | null {
    const isSpotify =
      track.source === "spotify" ||
      track.audioUrl?.startsWith("spotify:") === true;

    if (isSpotify) {
      if (!track.audioUrl || !track.audioUrl.startsWith("spotify:")) {
        return "Este track de Spotify no tiene una URI valida de reproduccion.";
      }
      return null;
    }

    const shouldRequirePlayableSource =
      track.source === "local" ||
      track.source === "jamendo" ||
      track.source === "youtube" ||
      track.source === "deezer" ||
      track.sourceType === "local" ||
      track.sourceType === "remote";

    if (!shouldRequirePlayableSource) {
      return null;
    }

    const source = track.objectUrl ?? track.audioUrl;
    if (!source || source.trim().length === 0) {
      return "Este track no tiene una fuente de audio valida.";
    }

    return null;
  }

  private isTrackPayloadPlayable(track: ITrack): boolean {
    return this.getInvalidTrackReason(track) === null;
  }

  private rescueInvalidDuplicate(track: ITrack): ITrack | null {
    if (this.isTrackPayloadPlayable(track)) {
      return null;
    }

    const identity = canonicalTrackIdentity(track.id);
    const queue = this.playlist.toArray();
    const existingPlayable = queue.find(
      (item) =>
        canonicalTrackIdentity(item.id) === identity &&
        this.isTrackPayloadPlayable(item),
    );

    if (!existingPlayable) {
      return null;
    }

    return existingPlayable;
  }

  private findExactQueueInjection(track: ITrack): ITrack | null {
    if (!track.queueItemId) {
      return null;
    }

    const queue = this.playlist.toArray();
    const existing = queue.find((item) => item.queueItemId === track.queueItemId);
    return existing ?? null;
  }

  private safePauseAdapter(): void {
    try {
      const maybePromise = this.mediaAdapter?.pause();
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
        void (maybePromise as Promise<unknown>).catch(() => {
          // best-effort pause
        });
      }
    } catch {
      // best-effort pause
    }
  }

  private async destroyAdapter(): Promise<void> {
    try {
      await this.mediaAdapter?.pause();
    } catch {
      // best-effort pause
    }

    try {
      await this.mediaAdapter?.destroy?.();
    } catch {
      // best-effort destroy
    }
  }

  private async playByDirection(direction: "next" | "previous"): Promise<ITrack | null> {
    const queueSize = this.playlist.size();
    if (queueSize === 0) {
      this.isPlaying = false;
      this.loading = false;
      this.notify();
      return null;
    }

    for (let attempts = 0; attempts < queueSize; attempts += 1) {
      const track = direction === "next" ? this.playlist.getNext() : this.playlist.getPrevious();

      if (!track) {
        this.isPlaying = false;
        this.loading = false;
        this.notify();
        return null;
      }

      const invalidReason = this.getInvalidTrackReason(track);
      if (invalidReason) {
        this.error = "Se omitio un track invalido de la cola.";
        this.notify();
        continue;
      }

      this.progressSeconds = 0;
      this.durationSeconds = 0;
      this.notify();

      try {
        await this.play();
      } catch {
        // play() ya no lanza para errores esperables.
      }

      if (!this.error) {
        return track;
      }
    }

    this.isPlaying = false;
    this.loading = false;
    this.error = "No hay tracks validos para reproducir en la cola.";
    this.notify();
    return null;
  }
}
