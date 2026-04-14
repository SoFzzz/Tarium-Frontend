"use client";

import { useEffect, useState } from "react";
import { type ITrack } from "@/lib/player/types";
import { type ICategory, type ISpotifyPlaylist } from "@/lib/spotify";
import { usePlayer } from "@/providers/PlayerProvider";
import { ArrowLeft, Play, Loader2 } from "lucide-react";

// Palette of vibrant background colors for genre cards
const GENRE_COLORS = [
  "from-rose-500/80 to-pink-600/80",
  "from-violet-500/80 to-purple-600/80",
  "from-blue-500/80 to-indigo-600/80",
  "from-cyan-500/80 to-teal-600/80",
  "from-emerald-500/80 to-green-600/80",
  "from-amber-500/80 to-orange-600/80",
  "from-red-500/80 to-rose-600/80",
  "from-fuchsia-500/80 to-pink-600/80",
  "from-sky-500/80 to-blue-600/80",
  "from-lime-500/80 to-emerald-600/80",
];

type ViewState =
  | { mode: "grid" }
  | { mode: "playlists"; category: ICategory };

export function GenresView() {
  const { actions } = usePlayer();
  const [viewState, setViewState] = useState<ViewState>({ mode: "grid" });
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Playlists state
  const [playlists, setPlaylists] = useState<ISpotifyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);

  // Load categories
  useEffect(() => {
    setLoading(true);
    fetch("/api/spotify/categories")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setCategories(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load playlists for category
  useEffect(() => {
    if (viewState.mode !== "playlists") return;
    const id = viewState.category.id;
    setPlaylistsLoading(true);
    setPlaylists([]);
    fetch(`/api/spotify/categories/${id}/playlists`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setPlaylists(data); })
      .catch(console.error)
      .finally(() => setPlaylistsLoading(false));
  }, [viewState]);

  const handleListenPlaylist = async (playlist: ISpotifyPlaylist) => {
    setLoadingPlaylistId(playlist.id);
    try {
      const res = await fetch(`/api/spotify/playlists/${playlist.id}/tracks`);
      const tracks: ITrack[] = await res.json();
      if (tracks.length > 0) {
        actions.setQueue(tracks);
      }
    } catch (err) {
      console.error("Error loading playlist tracks", err);
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  // --- GRID VIEW ---
  if (viewState.mode === "grid") {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
          Explorar géneros
        </p>
        {loading ? (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">Cargando géneros…</div>
        ) : categories.length === 0 ? (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            Conecta Spotify para explorar géneros musicales.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categories.map((cat, i) => (
              <button
                key={cat.id}
                type="button"
                className={`group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl bg-gradient-to-br ${GENRE_COLORS[i % GENRE_COLORS.length]} p-3 text-left shadow-sm transition-transform hover:scale-[1.03]`}
                onClick={() => setViewState({ mode: "playlists", category: cat })}
              >
                <img
                  src={cat.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
                />
                <span className="relative z-10 text-sm font-bold text-white drop-shadow-md line-clamp-2">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- PLAYLISTS VIEW ---
  const category = viewState.category;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
        <button
          type="button"
          className="mb-4 flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          onClick={() => setViewState({ mode: "grid" })}
        >
          <ArrowLeft size={14} /> Volver a géneros
        </button>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--line)]">
            <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl font-semibold">
              {category.name}
            </h2>
            <p className="text-xs text-[var(--muted)]">Playlists del género</p>
          </div>
        </div>
      </div>

      {playlistsLoading ? (
        <div className="text-center text-sm text-[var(--muted)] py-10">Cargando playlists…</div>
      ) : playlists.length === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-10">No se encontraron playlists.</div>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface-elevated)]"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--line)]">
                  <img src={pl.imageUrl} alt={pl.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold">{pl.name}</p>
                  <p className="truncate text-[10px] text-[var(--muted)]">{pl.tracksTotal} tracks</p>
                </div>
                <button
                  type="button"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-[11px] font-bold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  onClick={() => void handleListenPlaylist(pl)}
                  disabled={loadingPlaylistId === pl.id}
                >
                  {loadingPlaylistId === pl.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} className="ml-0.5" />
                  )}
                  Escuchar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
