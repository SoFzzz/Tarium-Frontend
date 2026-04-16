import { describe, expect, it, vi } from "vitest";

import type { MediaAdapter } from "@/lib/player/media-adapter";
import { mockTracks } from "@/lib/player/mock-tracks";
import { PlayerManager } from "@/lib/player/player-manager";
import type { ITrack } from "@/lib/player/types";

class TestMediaAdapter implements MediaAdapter {
  public play = vi.fn(async () => {});
  public pause = vi.fn(async () => {});
  public setVolume = vi.fn((_v: number) => {});
  public seekTo = vi.fn((_s: number) => {});
  public destroy = vi.fn(async () => {});
}

describe("PlayerManager", () => {
  it("loads the queue and exposes the first track as current", () => {
    const manager = new PlayerManager(mockTracks, new TestMediaAdapter());

    const state = manager.getState();

    expect(state.queue).toHaveLength(mockTracks.length);
    expect(state.currentTrack?.id).toBe(mockTracks[0]?.id);
    expect(state.isPlaying).toBe(false);
  });

  it("notifies subscribers when the queue changes", () => {
    const manager = new PlayerManager(mockTracks, new TestMediaAdapter());
    const listener = vi.fn();

    manager.subscribe(listener);
    manager.shuffle();

    expect(listener).toHaveBeenCalled();
  });

  it("plays the next track and updates current state", async () => {
    const manager = new PlayerManager(mockTracks, new TestMediaAdapter());

    await manager.playNext();

    expect(manager.getState().currentTrack?.id).toBe(mockTracks[1]?.id);
    expect(manager.getState().isPlaying).toBe(true);
  });

  it("restores queue without injecting a current track", () => {
    const manager = new PlayerManager([], new TestMediaAdapter());

    manager.restoreQueueWithoutCurrent(mockTracks);

    const state = manager.getState();
    expect(state.queue).toHaveLength(mockTracks.length);
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
  });

  it("avoids adding invalid duplicate when playable duplicate exists", () => {
    const manager = new PlayerManager([], new TestMediaAdapter());
    const playable: ITrack = {
      id: "ja:123",
      title: "Track A",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/track.mp3",
      source: "jamendo",
      sourceType: "remote",
    };

    const invalidDuplicate: ITrack = {
      id: "ja:123",
      title: "Track A",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      source: "jamendo",
      sourceType: "remote",
    };

    const first = manager.addTrack(playable);
    const second = manager.addTrack(invalidDuplicate);

    expect(manager.getState().queue).toHaveLength(1);
    expect(second.queueItemId).toBe(first.queueItemId);
  });

  it("does not inject the same queue item twice", () => {
    const manager = new PlayerManager([], new TestMediaAdapter());
    const first = manager.addToQueue({
      id: "ja:555",
      queueItemId: "ja:555::manual",
      title: "Same item",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/same-item.mp3",
      source: "jamendo",
      sourceType: "remote",
    });

    const second = manager.addToQueue({
      id: "ja:555",
      queueItemId: "ja:555::manual",
      title: "Same item",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/same-item.mp3",
      source: "jamendo",
      sourceType: "remote",
    });

    expect(manager.getState().queue).toHaveLength(1);
    expect(second.queueItemId).toBe(first.queueItemId);
  });

  it("playNow inserts next and starts playback without replacing queue", async () => {
    const manager = new PlayerManager(mockTracks, new TestMediaAdapter());
    const originalQueueLength = manager.getState().queue.length;
    const inserted = await manager.playNow({
      id: "ja:new-track",
      title: "Inserted next",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/new-track.mp3",
      source: "jamendo",
      sourceType: "remote",
    });

    const state = manager.getState();
    expect(inserted).not.toBeNull();
    expect(state.currentTrack?.queueItemId).toBe(inserted?.queueItemId);
    expect(state.isPlaying).toBe(true);
    expect(state.queue).toHaveLength(originalQueueLength + 1);
  });

  it("removing current track pauses adapter and advances consistently", async () => {
    const adapter = new TestMediaAdapter();
    const manager = new PlayerManager(
      [
        {
          id: "ja:first",
          title: "First",
          artist: "Artist",
          thumbnailUrl: "/placeholder.png",
          objectUrl: "https://cdn.example.com/first.mp3",
          source: "jamendo",
          sourceType: "remote",
        },
        {
          id: "ja:second",
          title: "Second",
          artist: "Artist",
          thumbnailUrl: "/placeholder.png",
          objectUrl: "https://cdn.example.com/second.mp3",
          source: "jamendo",
          sourceType: "remote",
        },
      ],
      adapter,
    );

    await manager.play();
    const currentTrack = manager.getState().currentTrack;
    expect(currentTrack).not.toBeNull();

    manager.removeTrack(currentTrack!.id, "trackId");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = manager.getState();
    expect(adapter.pause).toHaveBeenCalled();
    expect(state.currentTrack?.id).toBe("ja:second");
    expect(state.isPlaying).toBe(true);
    expect(state.queue).toHaveLength(1);
  });

  it("playNext skips invalid queue items and continues playback", async () => {
    const manager = new PlayerManager(
      [
        {
          id: "ja:start",
          title: "Start",
          artist: "Artist",
          thumbnailUrl: "/placeholder.png",
          objectUrl: "https://cdn.example.com/start.mp3",
          source: "jamendo",
          sourceType: "remote",
        },
        {
          id: "ja:invalid",
          title: "Invalid",
          artist: "Artist",
          thumbnailUrl: "/placeholder.png",
          source: "jamendo",
          sourceType: "remote",
        },
        {
          id: "lo:valid-local",
          title: "Local",
          artist: "Artist",
          thumbnailUrl: "/placeholder.png",
          objectUrl: "blob:https://example.local/track",
          source: "local",
          sourceType: "local",
        },
      ],
      new TestMediaAdapter(),
    );

    await manager.play();
    const played = await manager.playNext();

    const state = manager.getState();
    expect(played?.id).toBe("lo:valid-local");
    expect(state.currentTrack?.id).toBe("lo:valid-local");
    expect(state.isPlaying).toBe(true);
  });

  it("fase 6 - caso A: cola mixta inicio/search/local mantiene next y previous", async () => {
    const manager = new PlayerManager([], new TestMediaAdapter());

    const jamendoFromHome: ITrack = {
      id: "ja:home-1",
      title: "Home Track",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/home.mp3",
      source: "jamendo",
      sourceType: "remote",
    };
    const searchTrack: ITrack = {
      id: "ja:search-1",
      title: "Search Track",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/search.mp3",
      source: "jamendo",
      sourceType: "remote",
    };
    const localTrack: ITrack = {
      id: "lo:local-1",
      title: "Local Track",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "blob:https://example.local/local-1",
      source: "local",
      sourceType: "local",
    };

    await manager.playNow(jamendoFromHome, "home");
    manager.addToQueue(searchTrack, "search");
    manager.addToQueue(localTrack, "library");

    expect(manager.getState().queue).toHaveLength(3);
    expect(manager.getState().currentTrack?.id).toBe("ja:home-1");

    await manager.playNext();
    expect(manager.getState().currentTrack?.id).toBe("ja:search-1");

    await manager.playNext();
    expect(manager.getState().currentTrack?.id).toBe("lo:local-1");

    await manager.playPrevious();
    expect(manager.getState().currentTrack?.id).toBe("ja:search-1");
  });

  it("fase 6 - caso C: duplicado accidental invalido se rescata, duplicado intencional valido se permite", () => {
    const manager = new PlayerManager([], new TestMediaAdapter());

    const redLightFromHome: ITrack = {
      id: "ja:red-light",
      title: "RED LIGHT",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/red-light.mp3",
      source: "jamendo",
      sourceType: "remote",
    };

    const accidentalInvalidDuplicate: ITrack = {
      id: "ja:red-light",
      title: "RED LIGHT",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      source: "jamendo",
      sourceType: "remote",
    };

    const intentionalPlayableDuplicate: ITrack = {
      id: "ja:red-light",
      title: "RED LIGHT",
      artist: "Artist",
      thumbnailUrl: "/placeholder.png",
      objectUrl: "https://cdn.example.com/red-light.mp3",
      source: "jamendo",
      sourceType: "remote",
    };

    const first = manager.addToQueue(redLightFromHome, "home");
    const rescued = manager.addToQueue(accidentalInvalidDuplicate, "search");

    expect(manager.getState().queue).toHaveLength(1);
    expect(rescued.queueItemId).toBe(first.queueItemId);

    manager.addToQueue(intentionalPlayableDuplicate, "search");
    expect(manager.getState().queue).toHaveLength(2);
  });

  it("fase 1 - stopAndClear detiene audio real y limpia cola", async () => {
    const adapter = new TestMediaAdapter();
    const manager = new PlayerManager(
      [
        {
          id: "ja:start",
          title: "Start",
          artist: "Artist",
          thumbnailUrl: "/placeholder.png",
          objectUrl: "https://cdn.example.com/start.mp3",
          source: "jamendo",
          sourceType: "remote",
        },
      ],
      adapter,
    );

    await manager.play();
    await manager.stopAndClear();

    const state = manager.getState();
    expect(adapter.pause).toHaveBeenCalled();
    expect(adapter.destroy).toHaveBeenCalled();
    expect(state.queue).toHaveLength(0);
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
  });
});
