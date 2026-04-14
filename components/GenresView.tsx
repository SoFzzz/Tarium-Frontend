"use client";

import { useEffect, useState } from "react";
import { type ITrack } from "@/lib/player/types";
import { type ISpotifyPlaylist } from "@/lib/spotify";
import { usePlayer } from "@/providers/PlayerProvider";
import { ArrowLeft, Play, Loader2 } from "lucide-react";

// Hardcoded popular genres (Spotify browse/categories API was deprecated in 2024)
const GENRES = [
  { id: "pop", name: "Pop", color: "from-pink-500/80 to-rose-600/80" },
  { id: "rock", name: "Rock", color: "from-red-500/80 to-orange-600/80" },
  { id: "hip-hop", name: "Hip-Hop", color: "from-amber-500/80 to-yellow-600/80" },
  { id: "electronic", name: "Electronic", color: "from-cyan-500/80 to-blue-600/80" },
  { id: "jazz", name: "Jazz", color: "from-violet-500/80 to-purple-600/80" },
  { id: "classical", name: "Classical", color: "from-emerald-500/80 to-teal-600/80" },
  { id: "reggaeton", name: "Reggaeton", color: "from-orange-500/80 to-red-600/80" },
  { id: "r-n-b", name: "R&B", color: "from-fuchsia-500/80 to-pink-600/80" },
  { id: "metal", name: "Metal", color: "from-gray-600/80 to-gray-800/80" },
  { id: "indie", name: "Indie", color: "from-lime-500/80 to-emerald-600/80" },
  { id: "latin", name: "Latin", color: "from-rose-500/80 to-pink-600/80" },
  { id: "k-pop", name: "K-Pop", color: "from-sky-500/80 to-indigo-600/80" },
  { id: "city-pop", name: "City Pop", color: "from-purple-500/80 to-violet-600/80" },
  { id: "lo-fi", name: "Lo-fi", color: "from-teal-500/80 to-cyan-600/80" },
];

type ViewState =
  | { mode: "grid" }
  | { mode: "playlists"; genre: typeof GENRES[number] };

export function GenresView({ spotifyConnected }: { spotifyConnected?: boolean }) {
  const { actions } = usePlayer();
  const [viewState, setViewState] = useState<ViewState>({ mode: "grid" });

  // Playlists state
  const [playlists, setPlaylists] = useState<ISpotifyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);

  // Load playlists for genre via search
  useEffect(() => {
    if (viewState.mode !== "playlists" || !spotifyConnected) return;
    const genre = viewState.genre;
    setPlaylistsLoading(true);
    setPlaylists([]);
    fetch(`/api/spotify/search?q=${encodeURIComponent(genre.name)}&type=playlist&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.playlists?.items) {
          const items = data.playlists.items.filter(Boolean).map((p: any) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.images?.[0]?.url || "/placeholder.png",
            description: p.description || "",
            tracksTotal: p.tracks?.total || 0,
          }));
          setPlaylists(items);
        } else if (Array.isArray(data) && !data.length) {
          setPlaylists([]);
        }
      })
      .catch(console.error)
      .finally(() => setPlaylistsLoading(false));
  }, [viewState, spotifyConnected]);

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
        {!spotifyConnected ? (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            Conecta Spotify para explorar géneros musicales.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {GENRES.map((genre) => (
              <button
                key={genre.id}
                type="button"
                className={`group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl bg-gradient-to-br ${genre.color} p-3 text-left shadow-sm transition-transform hover:scale-[1.03]`}
                onClick={() => setViewState({ mode: "playlists", genre })}
              >
                <span className="relative z-10 text-sm font-bold text-white drop-shadow-md">
                  {genre.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- PLAYLISTS VIEW ---
  const genre = viewState.genre;
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
        <h2 className="font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl font-semibold">
          {genre.name}
        </h2>
        <p className="text-xs text-[var(--muted)]">Playlists del género</p>
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
