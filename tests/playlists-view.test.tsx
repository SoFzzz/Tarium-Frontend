import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlaylistsView } from "@/components/player/PlaylistsView";

describe("PlaylistsView", () => {
  it("fase 4 - no renderiza la seccion importar de Spotify", () => {
    render(
      <PlaylistsView
        playlists={[]}
        authenticated
        selectedPlaylistId={null}
        playlistTracks={null}
        loadingTracks={false}
        favoritedIds={new Set()}
        onSelectPlaylist={vi.fn()}
        onCreatePlaylist={vi.fn()}
        onPlayTrack={vi.fn()}
        onPlayAll={vi.fn()}
        onRemoveTrack={vi.fn()}
        onDeletePlaylist={vi.fn()}
        onToggleFavorite={vi.fn()}
        onReorderTracks={vi.fn()}
      />,
    );

    expect(screen.queryByText("Importar de Spotify")).not.toBeInTheDocument();
  });
});
