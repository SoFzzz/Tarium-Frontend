import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/lib/player/multi-source-audio-adapter", () => ({
  MultiSourceAudioAdapter: class {
    play = vi.fn(async () => {});
    pause = vi.fn(async () => {});
    setVolume = vi.fn(() => {});
    seekTo = vi.fn(() => {});
  },
}));

import { PlayerProvider, usePlayer } from "@/providers/PlayerProvider";

function TestConsumer() {
  const { state } = usePlayer();

  return (
    <div>
      <p data-testid="queue-size">{state.queue.length}</p>
      <p data-testid="current-track">{state.currentTrack?.title ?? "none"}</p>
    </div>
  );
}

const remoteTrack = [
  {
    id: "ja:track-1",
    title: "Track 1",
    artist: "Artist",
    thumbnailUrl: "/placeholder.png",
    objectUrl: "https://cdn.example.com/track-1.mp3",
    source: "jamendo",
    sourceType: "remote",
  },
];

describe("PlayerProvider session persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthMock.mockReturnValue({
      user: null,
      authLoading: false,
    });
    window.localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(null), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("fase 1 - no rehidrata cola privada cuando no hay sesion", async () => {
    window.localStorage.setItem("tarium.queue", JSON.stringify(remoteTrack));

    render(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("0");
      expect(screen.getByTestId("current-track")).toHaveTextContent("none");
    });

    expect(window.localStorage.getItem("tarium.queue")).toBeNull();
  });

  it("fase 1 - rehidrata solo la cola del usuario autenticado", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      authLoading: false,
    });

    window.localStorage.setItem("tarium.queue:user-a", JSON.stringify(remoteTrack));
    window.localStorage.setItem("tarium.queue:user-b", JSON.stringify([
      { ...remoteTrack[0], id: "ja:track-2", title: "Track 2" },
    ]));

    render(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("1");
    });

    expect(screen.getByTestId("current-track")).toHaveTextContent("none");
    expect(window.localStorage.getItem("tarium.queue:user-b")).toContain("Track 2");
  });

  it("fase 3 - al cerrar sesion limpia memoria y persistencia del usuario saliente", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      authLoading: false,
    });
    window.localStorage.setItem("tarium.queue:user-a", JSON.stringify(remoteTrack));

    const view = render(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("1");
    });

    useAuthMock.mockReturnValue({
      user: null,
      authLoading: false,
    });

    view.rerender(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("0");
      expect(screen.getByTestId("current-track")).toHaveTextContent("none");
    });

    expect(window.localStorage.getItem("tarium.queue:user-a")).toBeNull();
  });

  it("fase 6 - usuario A hace logout y usuario B no hereda su cola", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      authLoading: false,
    });

    window.localStorage.setItem("tarium.queue:user-a", JSON.stringify(remoteTrack));
    window.localStorage.setItem("tarium.queue:user-b", JSON.stringify([
      { ...remoteTrack[0], id: "ja:track-b", title: "Track B" },
    ]));

    const view = render(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("1");
    });

    useAuthMock.mockReturnValue({
      user: null,
      authLoading: false,
    });

    view.rerender(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("0");
      expect(screen.getByTestId("current-track")).toHaveTextContent("none");
    });

    useAuthMock.mockReturnValue({
      user: { id: "user-b" },
      authLoading: false,
    });

    view.rerender(
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-size")).toHaveTextContent("1");
      expect(screen.getByTestId("current-track")).toHaveTextContent("none");
    });

    expect(window.localStorage.getItem("tarium.queue:user-a")).toBeNull();
    expect(window.localStorage.getItem("tarium.queue:user-b")).toContain("Track B");
    expect(window.localStorage.getItem("tarium.queue:user-b")).not.toContain("Track 1");
  });
});
