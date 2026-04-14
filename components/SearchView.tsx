"use client";

import { useState } from "react";
import { Search as SearchIcon, Play, PlusCircle, Heart, ListPlus, Loader2 } from "lucide-react";
import type { ITrack } from "@/lib/player/types";
import { usePlayer } from "@/providers/PlayerProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlaylists } from "@/hooks/usePlaylists";

export function SearchView() {
  const { actions } = usePlayer();
  const { user } = useAuth();
  const { addFavorite } = useFavorites();
  const { playlists, addTrackToPlaylist } = usePlaylists();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Error al buscar");
      }
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search error", err);
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = async (track: ITrack) => {
    actions.addTrackNext(track);
    await actions.playById(track.id);
  };

  return (
    <div className="flex max-h-[85vh] flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      {/* Search bar — sticky top */}
      <div className="shrink-0 border-b border-[var(--line)] p-4 sm:p-6">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Buscar artistas, canciones, álbumes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-[var(--line)] bg-[var(--background)] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <SearchIcon size={14} />}
            Buscar
          </button>
        </form>
      </div>

      {/* Results — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
            <Loader2 size={20} className="mr-2 animate-spin" /> Buscando en Spotify…
          </div>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <div className="py-12 text-center text-sm text-[var(--muted)]">
            No se encontraron resultados para &quot;{query}&quot;
          </div>
        )}

        {!loading && !searched && (
          <div className="py-12 text-center text-sm text-[var(--muted)]">
            Escribe algo para buscar canciones, artistas o álbumes
          </div>
        )}

        {results.length > 0 && (
          <ul className="space-y-1">
            {results.map((track) => (
              <li
                key={track.id}
                className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface-elevated)] cursor-pointer"
                onClick={() => void handlePlayTrack(track)}
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <img src={track.thumbnailUrl} alt={track.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <Play size={18} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold group-hover:text-[var(--accent)]">{track.title}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {track.artist}
                    {track.durationInSeconds
                      ? ` • ${Math.floor(track.durationInSeconds / 60)}:${String(track.durationInSeconds % 60).padStart(2, "0")}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={(e) => { e.stopPropagation(); actions.addTrack(track); }}
                    title="Agregar a la cola"
                  >
                    <PlusCircle size={14} />
                  </button>
                  {user && (
                    <>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await addFavorite({
                            track_id: track.id,
                            title: track.title,
                            artist: track.artist,
                            thumbnail_url: track.thumbnailUrl,
                          });
                        }}
                        title="Favorito"
                      >
                        <Heart size={14} />
                      </button>
                      {playlists.length > 0 && (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await addTrackToPlaylist(playlists[0].id, {
                              track_id: track.id,
                              title: track.title,
                              artist: track.artist,
                              thumbnail_url: track.thumbnailUrl,
                              duration_seconds: track.durationInSeconds,
                            });
                          }}
                          title="Agregar a playlist"
                        >
                          <ListPlus size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
