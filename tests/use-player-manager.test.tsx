import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlayerManager } from "@/hooks/usePlayerManager";
import { BrowserMockMediaAdapter } from "@/lib/player/media-adapter";
import { mockTracks } from "@/lib/player/mock-tracks";
import { PlayerManager } from "@/lib/player/player-manager";

function HookHarness({ manager }: { manager: PlayerManager }) {
  const { state, actions } = usePlayerManager(manager);

  return (
    <div>
      <p data-testid="current-track">{state.currentTrack?.title ?? "none"}</p>
      <p data-testid="queue-size">{state.queue.length}</p>
      <button
        type="button"
        onClick={() => {
          void actions.playNext();
        }}
      >
        next
      </button>
    </div>
  );
}

describe("usePlayerManager", () => {
  it("syncs state updates from the manager into React", async () => {
    const manager = new PlayerManager(mockTracks, new BrowserMockMediaAdapter());

    render(<HookHarness manager={manager} />);

    expect(screen.getByTestId("current-track")).toHaveTextContent(mockTracks[0]?.title ?? "");
    expect(screen.getByTestId("queue-size")).toHaveTextContent(String(mockTracks.length));

    fireEvent.click(screen.getByRole("button", { name: "next" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-track")).toHaveTextContent(
        mockTracks[1]?.title ?? "",
      );
    });
  });
});
