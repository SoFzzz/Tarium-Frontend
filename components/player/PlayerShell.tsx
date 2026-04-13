"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Clock3,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  Heart,
  LogOut,
  User,
   Home,
   Library,
   Star,
  Search,
  Sun,
  Moon,
  Shuffle,
  Repeat,
  Repeat1,
} from "lucide-react";

import { usePlayer } from "@/providers/PlayerProvider";
import { useAuth } from "@/providers/AuthProvider";
import { usePlaylists, type Playlist, type PlaylistTrack } from "@/hooks/usePlaylists";
import { useFavorites, type Favorite } from "@/hooks/useFavorites";
import { SearchPanel } from "@/components/SearchPanel";
import { LocalLibraryDropzone } from "@/components/LocalLibraryDropzone";
import { LibraryView } from "./LibraryView";
import { FavoritesView } from "./FavoritesView";
import { PlaylistsView } from "./PlaylistsView";
import { mapLocalTrackToITrack, type LocalTrack, type ITrack } from "@/lib/player/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { AuthModalControlled } from "@/components/auth/AuthModal";

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) {
    return "--:--";
  }

  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function PlayerShell() {
  const { state, actions } = usePlayer();
  const { user, signOut } = useAuth();
  const { playlists, createPlaylist, getPlaylistTracks, addTrackToPlaylist, removeTrackFromPlaylist, deletePlaylist } = usePlaylists();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();

  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [createPlaylistName, setCreatePlaylistName] = useState("");
  const [createPlaylistLoading, setCreatePlaylistLoading] = useState(false);

  const [deletePlaylistOpen, setDeletePlaylistOpen] = useState(false);
  const [deletePlaylistId, setDeletePlaylistId] = useState<string | null>(null);
  const [deletePlaylistLoading, setDeletePlaylistLoading] = useState(false);
  
  const [activeView, setActiveView] = useState<"home" | "library" | "favorites" | "playlists">("home");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[] | null>(null);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  const [volume, setVolume] = useState(() => actions.getState().volume ?? 70);
  
  const currentTrack = state.currentTrack;
  const queue = state.queue;
  const currentTrackId = currentTrack?.id ?? null;
  const isCurrentTrackFavorite = currentTrack ? isFavorite(currentTrack.id) : false;

  useEffect(() => {
    if (user) {
      setAuthModalOpen(false);
    }
  }, [user]);

  // Si cambia el track actual, reseteamos cualquier estado de seek manual
  useEffect(() => {
    setIsSeeking(false);
    setSeekValue(null);
    setDisplayProgress(0);
  }, [currentTrackId]);

  // Barra de progreso más fluida: interpolamos visualmente con RAF.
  // Mantenemos el valor real (state.progressSeconds) como fuente de verdad para sincronización.
  useEffect(() => {
    if (!state.isPlaying || isSeeking) return;

    let raf: number;
    let lastTs: number | null = null;
    const tick = () => {
      setDisplayProgress((prev) => {
        if (state.durationSeconds <= 0) return prev;
        // Avanzar según el tiempo real entre frames.
        const now = performance.now();
        const deltaSeconds = lastTs === null ? 0 : (now - lastTs) / 1000;
        lastTs = now;
        return Math.min(prev + deltaSeconds, state.durationSeconds);
      });
      raf = requestAnimationFrame(tick);
    };

    lastTs = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.isPlaying, isSeeking, state.durationSeconds]);

  // Sincronizar con el valor real cada vez que Howler/PlayerManager actualiza.
  useEffect(() => {
    if (isSeeking) return;
    setDisplayProgress(state.progressSeconds);
  }, [state.progressSeconds, isSeeking]);

  // El slider de volumen debe tener estado propio (no depender de re-renders por progreso).
  useEffect(() => {
    setVolume(state.volume);
  }, [state.volume]);

  const handleLocalDropzoneTracksParsed = (localTracks: LocalTrack[]) => {
    const mapped = localTracks.map(mapLocalTrackToITrack);

    if (state.queue.length === 0) {
      actions.loadQueue(mapped);
      void actions.play();
      return;
    }

    for (const track of mapped) {
      actions.addTrack(track);
    }
  };

  const handleAddToFavorites = async () => {
    if (!currentTrack) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    try {
      if (isCurrentTrackFavorite) {
        await removeFavorite(currentTrack.id);
      } else {
        await addFavorite({
          track_id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          thumbnail_url: currentTrack.thumbnailUrl,
        });
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const handleRequestCreatePlaylist = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setCreatePlaylistName("");
    setCreatePlaylistOpen(true);
  };

  const handleConfirmCreatePlaylist = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    const trimmed = createPlaylistName.trim();
    if (!trimmed) return;

    try {
      setCreatePlaylistLoading(true);
      await createPlaylist(trimmed);
      setCreatePlaylistOpen(false);
      setCreatePlaylistName("");
    } catch (err) {
      console.error("Error creating playlist:", err);
    } finally {
      setCreatePlaylistLoading(false);
    }
  };

  const handleSelectPlaylist = async (id: string) => {
    setSelectedPlaylistId(id);
    setLoadingPlaylistTracks(true);
    try {
      const tracks = await getPlaylistTracks(id);
      setPlaylistTracks(tracks);
    } catch (err) {
      console.error("Error loading playlist tracks:", err);
      setPlaylistTracks([]);
    } finally {
      setLoadingPlaylistTracks(false);
    }
  };

  const mapPlaylistTrackToITrack = (track: PlaylistTrack): ITrack => ({
    id: track.track_id,
    title: track.title,
    artist: track.artist,
    thumbnailUrl: track.thumbnail_url,
    durationInSeconds: track.duration_seconds,
  });

  const mapFavoriteToITrack = (fav: Favorite): ITrack => ({
    id: fav.track_id,
    title: fav.title,
    artist: fav.artist,
    thumbnailUrl: fav.thumbnail_url,
  });

  const handlePlayPlaylistTrack = async (playlistTrack: PlaylistTrack) => {
    if (!playlistTracks || playlistTracks.length === 0) return;
    const tracks = playlistTracks.map(mapPlaylistTrackToITrack);
    actions.setQueue(tracks);
    await actions.playById(playlistTrack.track_id);
  };

  const handlePlayEntirePlaylist = async () => {
    if (!playlistTracks || playlistTracks.length === 0) return;
    const tracks = playlistTracks.map(mapPlaylistTrackToITrack);
    actions.setQueue(tracks);
    await actions.play();
  };

  const handleAddCurrentTrackToPlaylist = async () => {
    if (!selectedPlaylistId || !currentTrack) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    try {
      await addTrackToPlaylist(selectedPlaylistId, {
        track_id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        thumbnail_url: currentTrack.thumbnailUrl,
        duration_seconds: currentTrack.durationInSeconds,
      });
      const updated = await getPlaylistTracks(selectedPlaylistId);
      setPlaylistTracks(updated);
    } catch (err) {
      console.error("Error adding track to playlist:", err);
    }
  };

  const handleRemoveTrackFromPlaylist = async (track: PlaylistTrack) => {
    if (!selectedPlaylistId) return;
    try {
      await removeTrackFromPlaylist(selectedPlaylistId, track.track_id);
      setPlaylistTracks((prev) =>
        prev ? prev.filter((t) => t.track_id !== track.track_id) : prev,
      );
    } catch (err) {
      console.error("Error removing track from playlist:", err);
    }
  };

  const handleRequestDeletePlaylist = (playlistId: string) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setDeletePlaylistId(playlistId);
    setDeletePlaylistOpen(true);
  };

  const handleConfirmDeletePlaylist = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (!deletePlaylistId) return;

    try {
      setDeletePlaylistLoading(true);
      await deletePlaylist(deletePlaylistId);
      if (selectedPlaylistId === deletePlaylistId) {
        setSelectedPlaylistId(null);
        setPlaylistTracks(null);
      }
      setDeletePlaylistOpen(false);
      setDeletePlaylistId(null);
    } catch (err) {
      console.error("Error deleting playlist:", err);
    } finally {
      setDeletePlaylistLoading(false);
    }
  };

  const handleShuffleClick = () => {
    if (state.loading || queue.length < 2) return;

    actions.shuffle();

    // Tras barajar, usamos el estado más reciente del reproductor
    const latest = actions.getState();
    const first = latest.queue[0];

    if (first && !latest.isPlaying) {
      void actions.playById(first.id);
    }
  };

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {/* Sidebar fija */}
        <aside className="fixed left-0 top-0 flex h-full w-16 flex-col items-center justify-between border-r border-[var(--line)] bg-[var(--surface)] py-6">
          <div className="flex flex-col items-center gap-4">
            <div className="mb-4 h-9 w-9 rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--background)] flex items-center justify-center">
              T
            </div>
            <nav className="flex flex-col items-center gap-3 text-[var(--muted)]">
              <SidebarIcon
                icon={Home}
                label="Inicio"
                active={activeView === "home"}
                onClick={() => setActiveView("home")}
              />
              <SidebarIcon
                icon={Library}
                label="Biblioteca"
                active={activeView === "library"}
                onClick={() => setActiveView("library")}
              />
              <SidebarIcon
                icon={Star}
                label="Favoritos"
                active={activeView === "favorites"}
                onClick={() => setActiveView("favorites")}
              />
              <SidebarIcon
                icon={ListMusic}
                label="Playlists"
                active={activeView === "playlists"}
                onClick={() => setActiveView("playlists")}
              />
            </nav>
          </div>

            <div className="flex flex-col items-center gap-4">
            {user ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] text-xs"
                    onClick={signOut}
                  >
                    <LogOut size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Cerrar sesión</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <User size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Iniciar sesión</TooltipContent>
              </Tooltip>
            )}
          </div>
        </aside>

        {/* Contenido principal */}
        <section className="ml-16 flex min-h-screen flex-col bg-[var(--background)] pb-16">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-6 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                Tarium
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl">
                Tu reproductor de música local
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--muted)] sm:flex">
                <Search size={14} />
                <span>Busca en YouTube o carga archivos</span>
              </div>
              <ThemeToggleButton />
              {user ? (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <User size={16} />
                  <span className="max-w-[10rem] truncate">{user.email}</span>
                </div>
              ) : null}
            </div>
          </header>

          {/* Área principal */}
          <div className="flex flex-1 flex-col gap-4 bg-[var(--background)] px-4 pt-4 pb-24 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              {/* Grid principal: artwork + biblioteca local / vistas dinámicas */}
              <div className="flex flex-col gap-4">
                {/* Vista principal / biblioteca según activeView */}
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {activeView === "home" && (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                            Reproduciendo ahora
                          </p>
                          <h2 className="mt-1 truncate font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl">
                            {currentTrack ? currentTrack.title : "Ningún track seleccionado"}
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {currentTrack ? currentTrack.artist : "Carga archivos o añade pistas a la cola"}
                          </p>
                        </>
                      )}
                      {activeView === "library" && (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                            Biblioteca local
                          </p>
                          <h2 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl">
                            Todos tus archivos cargados
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            Haz clic en cualquier track para reproducirlo o márcalo como favorito.
                          </p>
                        </>
                      )}
                      {activeView === "favorites" && (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                            Favoritos
                          </p>
                          <h2 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl">
                            Tus canciones guardadas
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            Gestiona y reproduce tus favoritos desde aquí.
                          </p>
                        </>
                      )}
                      {activeView === "playlists" && (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                            Playlists
                          </p>
                          <h2 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl">
                            Organiza tus sesiones
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            Crea playlists, añade o quita canciones y lánzalas a la reproducción.
                          </p>
                        </>
                      )}
                    </div>
                    {currentTrack && activeView === "home" && (
                      <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--line)] sm:block">
                        <img
                          src={currentTrack.thumbnailUrl}
                          alt={currentTrack.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {activeView === "home" && (
                    <>
                      <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
                        <div className="flex items-center gap-2">
                          <Clock3 size={14} />
                          <span>
                            {formatDuration(
                              isSeeking && seekValue !== null ? seekValue : displayProgress,
                            )}{" "}
                            / {formatDuration(state.durationSeconds)}
                          </span>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <ListMusic size={14} />
                          <span>{queue.length} en cola</span>
                        </div>
                      </div>

                      <Slider
                        value={
                          state.durationSeconds > 0
                            ? [isSeeking && seekValue !== null ? seekValue : displayProgress]
                            : [0]
                        }
                        max={state.durationSeconds || 0}
                        step={1}
                        disabled={state.durationSeconds <= 0}
                        onValueChange={([val]) => {
                          setIsSeeking(true);
                          setSeekValue(val);
                        }}
                        onValueCommit={([val]) => {
                          setIsSeeking(false);
                          setSeekValue(val);
                          setDisplayProgress(val);
                          actions.seek(val);
                        }}
                        className="mt-2 w-full"
                      />
                    </>
                  )}
                </div>
                {activeView === "home" && (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                          Biblioteca local
                        </p>
                        <p className="text-xs text-[var(--muted)]">Arrastra archivos o usa el botón para cargarlos</p>
                      </div>
                    </div>

                    <LocalLibraryDropzone onTracksParsed={handleLocalDropzoneTracksParsed} />
                  </div>
                )}
                {activeView === "library" && (
                  <LibraryView
                    queue={queue}
                    currentTrackId={currentTrackId}
                    authenticated={Boolean(user)}
                    playlists={playlists}
                    onPlayTrack={(id) => void actions.playById(id)}
                    onToggleFavorite={async (track) => {
                      if (!track) return;

                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      const favorite = isFavorite(track.id);
                      if (favorite) {
                        await removeFavorite(track.id);
                      } else {
                        await addFavorite({
                          track_id: track.id,
                          title: track.title,
                          artist: track.artist,
                          thumbnail_url: track.thumbnailUrl,
                        });
                      }
                    }}
                    onAddTrackToPlaylist={async (playlistId, track) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      await addTrackToPlaylist(playlistId, {
                        track_id: track.id,
                        title: track.title,
                        artist: track.artist,
                        thumbnail_url: track.thumbnailUrl,
                        duration_seconds: track.durationInSeconds,
                      });
                    }}
                  />
                )}
                {activeView === "favorites" && (
                  <FavoritesView
                    favorites={favorites}
                    authenticated={Boolean(user)}
                    onPlayFavorite={(fav) => {
                      const trackInQueue = queue.find((t) => t.id === fav.track_id);
                      if (trackInQueue) {
                        void actions.playById(trackInQueue.id);
                        return;
                      }

                      const mapped = mapFavoriteToITrack(fav);
                      actions.addTrack(mapped);
                      void actions.playById(mapped.id);
                    }}
                    onRemoveFavorite={async (fav) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      await removeFavorite(fav.track_id);
                    }}
                  />
                )}
                {activeView === "playlists" && (
                  <PlaylistsView
                    playlists={playlists}
                    authenticated={Boolean(user)}
                    selectedPlaylistId={selectedPlaylistId}
                    playlistTracks={playlistTracks}
                    loadingTracks={loadingPlaylistTracks}
                    onSelectPlaylist={(id) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      return handleSelectPlaylist(id);
                    }}
                    onCreatePlaylist={handleRequestCreatePlaylist}
                    onPlayTrack={handlePlayPlaylistTrack}
                    onPlayAll={handlePlayEntirePlaylist}
                    onRemoveTrack={(track) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      return handleRemoveTrackFromPlaylist(track);
                    }}
                    onDeletePlaylist={(playlistId) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      return handleRequestDeletePlaylist(playlistId);
                    }}
                    onAddCurrentTrack={handleAddCurrentTrackToPlaylist}
                    canAddCurrentTrack={Boolean(currentTrack && selectedPlaylistId)}
                  />
                )}
              </div>

              {/* Cola + búsqueda YouTube */}
              <div className="flex flex-col gap-4">
                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                        Cola
                      </p>
                      <p className="text-xs text-[var(--muted)]">Toca un track para reproducirlo</p>
                    </div>
                  </div>

                  <ScrollArea className="max-h-64 px-2 py-2">
                    {queue.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-[var(--muted)]">
                        No hay nada en la cola todavía.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {queue.map((track) => {
                          const isCurrent = track.id === currentTrackId;
                          return (
                            <li key={track.id}>
                              <button
                                type="button"
                                className={`flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left text-xs transition-colors ${
                                  isCurrent
                                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/10"
                                    : "border-transparent hover:border-[var(--line)] hover:bg-[var(--surface-elevated)]"
                                }`}
                                onClick={() => void actions.playById(track.id)}
                              >
                                <img
                                  src={track.thumbnailUrl}
                                  alt={track.title}
                                  className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold">{track.title}</p>
                                  <p className="truncate text-[11px] text-[var(--muted)]">
                                    {track.artist}
                                  </p>
                                </div>
                                <span className="ml-2 text-[11px] text-[var(--muted)]">
                                  {formatDuration(track.durationInSeconds)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </ScrollArea>
                </div>

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                    Búsqueda en YouTube
                  </p>
                  <SearchPanel />
                </div>
              </div>
            </div>
          </div>

          {/* Barra de reproducción inferior fija */}
          <footer className="fixed bottom-0 left-16 right-0 flex h-16 items-center gap-4 border-t border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6">
            {/* Artwork + info */}
            <div className="flex min-w-0 flex-[2] items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-elevated)]">
                {currentTrack ? (
                  <img
                    src={currentTrack.thumbnailUrl}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {currentTrack ? currentTrack.title : "Nada reproduciéndose"}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {currentTrack ? currentTrack.artist : "Selecciona un track para empezar"}
                </p>
              </div>
              {currentTrack && (
                user ? (
                  <button
                    type="button"
                    className={`ml-1 flex h-8 w-8 items-center justify-center rounded-full border text-[var(--muted)] ${
                      isCurrentTrackFavorite
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-[var(--line)]"
                    }`}
                    onClick={handleAddToFavorites}
                  >
                    <Heart size={16} fill={isCurrentTrackFavorite ? "currentColor" : "none"} />
                  </button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <button
                          type="button"
                          disabled
                          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed"
                        >
                          <Heart size={16} />
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Inicia sesión para guardar</TooltipContent>
                  </Tooltip>
                )
              )}
            </div>

            {/* Controles principales */}
            <div className="flex flex-[3] flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading}
                  onClick={() => void actions.playPrevious()}
                  className="text-[var(--foreground)]"
                >
                  <SkipBack size={18} />
                </Button>
                <Button
                  size="lg"
                  className="h-10 min-w-24 rounded-full px-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-white hover:text-white"
                  disabled={state.loading || !currentTrack}
                  onClick={() => void actions.togglePlayPause()}
                >
                  {state.loading ? "Cargando" : state.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading || queue.length < 2}
                  onClick={handleShuffleClick}
                  className={queue.length >= 2 ? "text-[var(--foreground)]" : "text-[var(--muted)]"}
                >
                  <Shuffle size={18} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading}
                  onClick={() => actions.cycleRepeatMode()}
                  className={
                    state.repeatMode === "off" ? "text-[var(--muted)]" : "text-[var(--accent)]"
                  }
                >
                  {state.repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading}
                  onClick={() => void actions.playNext()}
                  className="text-[var(--foreground)]"
                >
                  <SkipForward size={18} />
                </Button>
              </div>
            </div>

            {/* Volumen */}
            <div className="hidden flex-[2] items-center justify-end gap-3 sm:flex">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Volume2 size={16} />
                <span className="w-7 text-right">{volume}</span>
              </div>
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={([val]) => {
                  setVolume(val);
                  actions.setVolume(val);
                }}
                className="w-24"
              />
              <div className="hidden flex-col items-end text-xs text-[var(--muted)] md:flex">
                <span>
                  {formatDuration(isSeeking && seekValue !== null ? seekValue : displayProgress)}
                </span>
                <span>{formatDuration(state.durationSeconds)}</span>
              </div>
            </div>
          </footer>
        </section>
      </main>

      <AuthModalControlled open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Modal: crear playlist (reemplaza prompt) */}
      <Dialog.Root
        open={createPlaylistOpen}
        onOpenChange={(open) => {
          setCreatePlaylistOpen(open);
          if (!open) {
            setCreatePlaylistName("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
          >
            <Dialog.Title className="text-sm font-semibold text-[var(--foreground)]">Nueva playlist</Dialog.Title>
            <Dialog.Description className="sr-only">Crea una nueva playlist</Dialog.Description>
            <input
              value={createPlaylistName}
              onChange={(e) => setCreatePlaylistName(e.target.value)}
              maxLength={50}
              placeholder="Nombre de la playlist"
              className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleConfirmCreatePlaylist();
                }
              }}
              autoFocus
              disabled={createPlaylistLoading}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="h-8 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--foreground)] hover:bg-[var(--surface-elevated)] disabled:opacity-50"
                  disabled={createPlaylistLoading}
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="h-8 rounded-full bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                onClick={() => void handleConfirmCreatePlaylist()}
                disabled={createPlaylistLoading || !createPlaylistName.trim()}
              >
                {createPlaylistLoading ? "Creando…" : "Crear"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal: confirmar delete (reemplaza confirm) */}
      <Dialog.Root
        open={deletePlaylistOpen}
        onOpenChange={(open) => {
          setDeletePlaylistOpen(open);
          if (!open) setDeletePlaylistId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
          >
            <Dialog.Title className="text-sm font-semibold text-[var(--foreground)]">Eliminar playlist</Dialog.Title>
            <Dialog.Description className="sr-only">Confirma la eliminacion de una playlist</Dialog.Description>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Esta acción no se puede deshacer. ¿Seguro que quieres eliminarla?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="h-8 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--foreground)] hover:bg-[var(--surface-elevated)] disabled:opacity-50"
                  disabled={deletePlaylistLoading}
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="h-8 rounded-full border border-red-500/40 bg-red-500/15 px-3 text-xs font-semibold text-red-100 hover:bg-red-500/25 disabled:opacity-50"
                onClick={() => void handleConfirmDeletePlaylist()}
                disabled={deletePlaylistLoading}
              >
                {deletePlaylistLoading ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </TooltipProvider>
  );
}

type SidebarIconProps = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

function SidebarIcon({ icon: Icon, label, active, onClick }: SidebarIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            active
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
          }`}
          onClick={onClick}
        >
          <Icon size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)]"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {mounted ? (
            isDark ? <Sun size={16} /> : <Moon size={16} />
          ) : (
            <div className="h-4 w-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {mounted ? (isDark ? "Tema claro" : "Tema oscuro") : "Tema"}
      </TooltipContent>
    </Tooltip>
  );
}
