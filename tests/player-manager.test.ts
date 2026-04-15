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
});
