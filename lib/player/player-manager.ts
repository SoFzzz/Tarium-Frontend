import type { MediaAdapter } from "./media-adapter";
import { DoublyLinkedList } from "./structures/doubly-linked-list";
import type { ITrack, PlaybackState } from "./types";

type Subscriber = (state: PlaybackState) => void;

export class PlayerManager {
  private playlist: DoublyLinkedList<ITrack>;
  private isPlaying = false;
  private loading = false;
  private volume = 72;
  private mediaAdapter: MediaAdapter | null;
  private subscribers = new Set<Subscriber>();

  constructor(initialTracks: ITrack[] = [], mediaAdapter: MediaAdapter | null = null) {
    this.playlist = new DoublyLinkedList<ITrack>((track) => track.id);
    this.mediaAdapter = mediaAdapter;

    if (initialTracks.length > 0) {
      this.loadQueue(initialTracks);
    }
  }

  public loadQueue(tracks: ITrack[]): void {
    this.playlist.clear();

    for (const track of tracks) {
      this.playlist.insertAtEnd(track);
    }

    this.isPlaying = false;
    this.loading = false;
    this.notify();
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

    await this.play();
    return track;
  }

  public async playNext(): Promise<ITrack | null> {
    const track = this.playlist.getNext();

    if (track === null) {
      return null;
    }

    await this.play();
    return track;
  }

  public async playPrevious(): Promise<ITrack | null> {
    const track = this.playlist.getPrevious();

    if (track === null) {
      return null;
    }

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

  public getState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      loading: this.loading,
      volume: this.volume,
      currentTrack: this.playlist.getCurrent(),
      queue: this.playlist.toArray(),
    };
  }

  public subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);

    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getState();

    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }
}
