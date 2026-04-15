import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useFavorites, type Favorite } from "@/hooks/useFavorites";

const mockUseAuth = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function HookHarness({
  onRender,
}: {
  onRender: (value: ReturnType<typeof useFavorites>) => void;
}) {
  const value = useFavorites();
  onRender(value);
  return null;
}

describe("useFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      session: { user: { id: "user-1" } },
      authLoading: true,
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("evita inserciones concurrentes duplicadas por track", async () => {
    const resolveInsertRef: {
      current: ((value: { data: Favorite; error: null }) => void) | null;
    } = { current: null };
    const insertSingle = vi.fn(
      () =>
        new Promise<{ data: Favorite; error: null }>((resolve) => {
          resolveInsertRef.current = resolve;
        })
    );
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    const select = vi.fn();

    mockFrom.mockImplementation(() => ({ insert, select }));

    let latestHook: ReturnType<typeof useFavorites> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latestHook = value;
        }}
      />
    );

    const track = {
      track_id: "spotify:track:abc123",
      title: "Track",
      artist: "Artist",
      thumbnail_url: "thumb",
    };

    let firstCall: Promise<Favorite | null> | null = null;
    let secondCall: Promise<Favorite | null> | null = null;

    await act(async () => {
      firstCall = latestHook!.addFavorite(track);
      secondCall = latestHook!.addFavorite(track);
    });

    expect(insert).toHaveBeenCalledTimes(1);

    if (!resolveInsertRef.current) {
      throw new Error("resolver de insercion no inicializado");
    }

    resolveInsertRef.current({
      data: {
        id: "fav-1",
        user_id: "user-1",
        track_id: track.track_id,
        title: track.title,
        artist: track.artist,
        thumbnail_url: track.thumbnail_url,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });

    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });
  });

  it("trata conflicto 409/duplicate como exito logico", async () => {
    const insertSingle = vi.fn(async () => ({
      data: null,
      error: {
        code: "23505",
        status: 409,
        message: "duplicate key value violates unique constraint",
      },
    }));
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));

    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "fav-existing",
        user_id: "user-1",
        track_id: "spotify:track:dup",
        title: "Existing",
        artist: "Artist",
        thumbnail_url: "thumb",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    }));
    const eqTrack = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqTrack }));
    const select = vi.fn(() => ({ eq: eqUser }));

    mockFrom.mockImplementation(() => ({ insert, select }));

    let latestHook: ReturnType<typeof useFavorites> | null = null;
    render(
      <HookHarness
        onRender={(value) => {
          latestHook = value;
        }}
      />
    );

    let result: Favorite | null = null;
    await act(async () => {
      result = await latestHook!.addFavorite({
        track_id: "spotify:track:dup",
        title: "Existing",
        artist: "Artist",
        thumbnail_url: "thumb",
      });
    });

    expect(result).not.toBeNull();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(maybeSingle).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(latestHook!.isFavorite("spotify:track:dup")).toBe(true);
      expect(latestHook!.error).toBeNull();
    });
  });
});
