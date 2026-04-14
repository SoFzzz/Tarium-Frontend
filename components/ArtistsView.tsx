"use client";

import { useEffect, useState } from "react";
import { type ITrack } from "@/lib/player/types";
import { type IArtist, type IAlbum } from "@/lib/spotify";
import { usePlayer } from "@/providers/PlayerProvider";
import { ArrowLeft, Play } from "lucide-react";

type ViewState = { mode: "grid" } | { mode: "detail"; artist: IArtist };

export function ArtistsView({ spotifyConnected }: { spotifyConnected?: boolean }) {
  const { actions } = usePlayer();
  const [viewState, setViewState] = useState<ViewState>({ mode: "grid" });
  const [artists, setArtists] = useState<IArtist[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail state
  const [topTracks, setTopTracks] = useState<ITrack[]>([]);
  const [albums, setAlbums] = useState<IAlbum[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load grid
  useEffect(() => {
    if (!spotifyConnected) return;
    setLoading(true);
    fetch("/api/spotify/top-artists")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setArtists(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [spotifyConnected]);

  // Load detail
  useEffect(() => {
    if (viewState.mode !== "detail") return;
    const id = viewState.artist.id;
    setDetailLoading(true);
    setTopTracks([]);
    setAlbums([]);

    Promise.all([
      fetch(`/api/spotify/artists/${id}/top-tracks`).then((r) => r.json()),
      fetch(`/api/spotify/artists/${id}/albums`).then((r) => r.json()),
    ])
      .then(([tracks, albs]) => {
        if (!tracks.error) setTopTracks(tracks);
        if (!albs.error) setAlbums(albs);
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [viewState]);

  const handlePlayAll = () => {
    if (topTracks.length > 0) {
      actions.setQueue(topTracks);
    }
  };

  const handlePlayTrack = async (track: ITrack) => {
    actions.addTrackNext(track);
    await actions.playById(track.id);
  };

  // --- GRID VIEW ---
  if (viewState.mode === "grid") {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
          Tus artistas destacados
        </p>
        {loading ? (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">Cargando artistas…</div>
        ) : !spotifyConnected ? (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            Conecta Spotify para ver tus artistas más escuchados.
          </div>
        ) : artists.length === 0 ? (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            No se encontraron artistas.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {artists.map((a) => (
              <button
                key={a.id}
                type="button"
                className="group flex flex-col items-center gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--surface-elevated)]"
                onClick={() => setViewState({ mode: "detail", artist: a })}
              >
                <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[var(--line)] shadow-sm transition-transform group-hover:scale-105">
                  <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold group-hover:text-[var(--accent)] line-clamp-2">
                    {a.name}
                  </p>
                  {a.genres && a.genres.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-[var(--muted)] capitalize line-clamp-1">
                      {a.genres[0]}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- DETAIL VIEW ---
  const artist = viewState.artist;
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
        <button
          type="button"
          className="mb-4 flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          onClick={() => setViewState({ mode: "grid" })}
        >
          <ArrowLeft size={14} /> Volver a artistas
        </button>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full border border-[var(--line)] shadow-md">
            <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-[family-name:var(--font-cormorant)] text-3xl sm:text-4xl font-semibold">
              {artist.name}
            </h2>
            {artist.genres && artist.genres.length > 0 && (
              <p className="mt-1 text-xs text-[var(--muted)] capitalize">
                {artist.genres.slice(0, 3).join(" · ")}
              </p>
            )}
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              onClick={handlePlayAll}
              disabled={topTracks.length === 0}
            >
              <Play size={14} className="ml-0.5" /> Reproducir discografía
            </button>
          </div>
        </div>
      </div>

      {detailLoading ? (
        <div className="text-center text-sm text-[var(--muted)] py-10">Cargando detalles…</div>
      ) : (
        <>
          {/* Top Tracks */}
          {topTracks.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
                Canciones populares
              </p>
              <ul className="space-y-1">
                {topTracks.map((track, i) => (
                  <li
                    key={track.id}
                    className="group flex items-center justify-between rounded-xl p-2 transition-colors hover:bg-[var(--surface-elevated)] cursor-pointer"
                    onClick={() => void handlePlayTrack(track)}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="w-5 text-right text-[10px] text-[var(--muted)]">{i + 1}</span>
                      <img src={track.thumbnailUrl} alt={track.title} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold group-hover:text-[var(--accent)]">{track.title}</p>
                        <p className="truncate text-[10px] text-[var(--muted)]">{track.artist}</p>
                      </div>
                    </div>
                    <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white opacity-0 transition-opacity hover:scale-110 group-hover:opacity-100 ml-2">
                      <Play size={14} className="ml-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Albums */}
          {albums.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
                Álbumes
              </p>
              <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {albums.map((album) => (
                  <div key={album.id} className="flex min-w-[130px] flex-col gap-2 group">
                    <div className="h-[130px] w-[130px] overflow-hidden rounded-xl border border-[var(--line)] shadow-sm transition-transform group-hover:scale-105">
                      <img src={album.imageUrl} alt={album.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-medium truncate group-hover:text-[var(--accent)]">{album.name}</p>
                      <p className="text-[10px] text-[var(--muted)] truncate">{album.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
