"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
    Star,
  Search,
  Sun,
  Moon,
  Shuffle,
  Repeat,
  Repeat1,
  GripVertical,
  Trash2,
  Music2,
  Radio,
  FolderOpen
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";

import { usePlayer } from "@/providers/PlayerProvider";
import { useAuth } from "@/providers/AuthProvider";
import { usePlaylists, type Playlist, type PlaylistTrack } from "@/hooks/usePlaylists";
import { useFavorites, type Favorite } from "@/hooks/useFavorites";

import { LocalLibraryDropzone } from "@/components/LocalLibraryDropzone";
import { LibraryView } from "./LibraryView";
import { FavoritesView } from "./FavoritesView";
import { PlaylistsView } from "./PlaylistsView";
import { mapLocalTrackToITrack, type LocalTrack, type ITrack } from "@/lib/player/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { AuthModalControlled } from "@/components/auth/AuthModal";
import { useSpotifySession } from "@/hooks/useSpotifySession";
import { HomeView } from "@/components/HomeView";
import { NowPlayingView } from "@/components/NowPlayingView";
import { GenresView } from "@/components/GenresView";
import { SearchView } from "@/components/SearchView";

const QUEUE_BACKUP_KEY = "tarium_queue_backup";

function isTrackValidAcrossSessions(track: ITrack): boolean {
  if (track.sourceType === "local" || track.source === "local") return false;
  if (track.objectUrl?.startsWith("blob:")) return false;
  return true;
}

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) {
    return "--:--";
  }

  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

function SidebarIcon({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--muted)] hover:text-[var(--accent)]"
      }`}
    >
      <Icon size={20} />
    </button>
  );
}


function MobileNavIcon({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)]"
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}





export function PlayerShell() {
  const { state, actions } = usePlayer();
  const { user, signOut } = useAuth();
  const spotifySession = useSpotifySession();
  const {
    playlists,
    createPlaylist,
    getPlaylistTracks,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
    deletePlaylist,
  } = usePlaylists();
  const { favorites, addFavorite, removeFavorite, isFavorite, spotifyFavIds } = useFavorites();

  // Set estable: evita re-renders de LibraryView por ticks de progreso.
  const favoritedIds = useMemo(() => new Set<string>(favorites.map((f) => f.track_id)), [favorites]);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [createPlaylistName, setCreatePlaylistName] = useState("");
  const [createPlaylistLoading, setCreatePlaylistLoading] = useState(false);

  const [deletePlaylistOpen, setDeletePlaylistOpen] = useState(false);
  const [deletePlaylistId, setDeletePlaylistId] = useState<string | null>(null);
  const [deletePlaylistLoading, setDeletePlaylistLoading] = useState(false);
  
  const [activeView, setActiveView] = useState<"home" | "library" | "favorites" | "playlists" | "genres" | "nowplaying" | "search">("home");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[] | null>(null);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);
  const [spotifyPlaybackNotice, setSpotifyPlaybackNotice] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    if (state.currentTrack && state.isPlaying) {
      setActiveView("nowplaying");
    }
  }, [state.currentTrack, state.isPlaying]);
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  const [volume, setVolume] = useState(() => actions.getState().volume ?? 70);
  const restoredQueueRef = useRef(false);
  
  const currentTrack = state.currentTrack;
  const queue = state.queue;
  const currentTrackQueueItemId = currentTrack?.queueItemId ?? null;
  const isCurrentTrackFavorite = currentTrack ? isFavorite(currentTrack.id) : false;

  const isSpotifyTrack = (track: ITrack | null | undefined) =>
    Boolean(track && (track.source === "spotify" || track.audioUrl?.startsWith("spotify:") === true));

  const ensureSpotifyPlaybackAllowed = (track: ITrack | null | undefined) => {
    if (!isSpotifyTrack(track)) return true;
    if (spotifySession.status === "connected") return true;
    setSpotifyPlaybackNotice("Reconecta Spotify para reproducir esta pista.");
    return false;
  };

  const handlePlaybackError = (err: unknown, track: ITrack | null | undefined) => {
    if (isSpotifyTrack(track)) {
      setSpotifyPlaybackNotice("Reconecta Spotify para reproducir esta pista.");
    }
    console.error("Playback error:", err);
  };

  const getCurrentIndex = () =>
    queue.findIndex((item) => (item.queueItemId ?? item.id) === currentTrackQueueItemId);

  const getNextTrackCandidate = (): ITrack | null => {
    const idx = getCurrentIndex();
    if (idx < 0) return queue[0] ?? null;
    return queue[idx + 1] ?? null;
  };

  const getPreviousTrackCandidate = (): ITrack | null => {
    const idx = getCurrentIndex();
    if (idx <= 0) return queue[0] ?? null;
    return queue[idx - 1] ?? null;
  };

  useEffect(() => {
    if (user) {
      setAuthModalOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (spotifySession.status === "connected") {
      setSpotifyPlaybackNotice(null);
    }
  }, [spotifySession.status]);

  useEffect(() => {
    if (restoredQueueRef.current) return;
    if (spotifySession.status === "loading") return;
    try {
      // OAuth redirect can wipe sessionStorage; use localStorage for resilience.
      const backup = localStorage.getItem(QUEUE_BACKUP_KEY);
      if (!backup) return;

      const currentQueue = actions.getState().queue;
      if (currentQueue.length > 0) {
        localStorage.removeItem(QUEUE_BACKUP_KEY);
        return;
      }

      const restored = JSON.parse(backup) as ITrack[];
      if (Array.isArray(restored) && restored.length > 0) {
        const safeRestored = restored.filter(isTrackValidAcrossSessions);
        if (safeRestored.length > 0) {
          actions.loadQueue(safeRestored);
        }
      }
      localStorage.removeItem(QUEUE_BACKUP_KEY);
      restoredQueueRef.current = true;
    } catch {
      localStorage.removeItem(QUEUE_BACKUP_KEY);
      restoredQueueRef.current = true;
    }
  }, [actions, spotifySession.status]);

  // Si cambia el track actual, reseteamos cualquier estado de seek manual
  useEffect(() => {
    setIsSeeking(false);
    setSeekValue(null);
    setDisplayProgress(0);
  }, [currentTrackQueueItemId]);

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

    mapped.forEach((track) => {
      actions.addTrack(track);
    });
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
    queueItemId: track.id,
    id: track.track_id,
    title: track.title,
    artist: track.artist,
    thumbnailUrl: track.thumbnail_url,
    durationInSeconds: track.duration_seconds,
    audioUrl:
      track.track_id.startsWith("spotify:track:")
        ? track.track_id
        : /^[A-Za-z0-9]{22}$/.test(track.track_id)
          ? `spotify:track:${track.track_id}`
          : undefined,
    source:
      track.track_id.startsWith("spotify:track:") || /^[A-Za-z0-9]{22}$/.test(track.track_id)
        ? "spotify"
        : undefined,
    sourceType:
      track.track_id.startsWith("spotify:track:") || /^[A-Za-z0-9]{22}$/.test(track.track_id)
        ? "remote"
        : undefined,
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
    const target = tracks.find((t) => t.queueItemId === playlistTrack.id);
    if (!ensureSpotifyPlaybackAllowed(target)) return;
    actions.setQueue(tracks);
    setActiveView("home");
    try {
      await actions.playByQueueItemId(playlistTrack.id);
    } catch (err) {
      handlePlaybackError(err, target);
    }
  };

  const handlePlayEntirePlaylist = async () => {
    if (!playlistTracks || playlistTracks.length === 0) return;
    const tracks = playlistTracks.map(mapPlaylistTrackToITrack);
    if (!ensureSpotifyPlaybackAllowed(tracks[0])) return;
    actions.setQueue(tracks);
    setActiveView("home");
    try {
      await actions.play();
    } catch (err) {
      handlePlaybackError(err, tracks[0]);
    }
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
      await removeTrackFromPlaylist(selectedPlaylistId, track.id);
      setPlaylistTracks((prev) =>
        prev ? prev.filter((t) => t.id !== track.id) : prev,
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
      if (!ensureSpotifyPlaybackAllowed(first)) return;
      const queueItemId = first.queueItemId ?? first.id;
      void actions.playByQueueItemId(queueItemId).catch((err) => {
        handlePlaybackError(err, first);
      });
    }
  };

  const handleSpotifyLogin = () => {
    try {
      const currentQueue = actions.getState().queue.filter(isTrackValidAcrossSessions);
      if (currentQueue.length > 0) {
        localStorage.setItem(QUEUE_BACKUP_KEY, JSON.stringify(currentQueue));
      } else {
        localStorage.removeItem(QUEUE_BACKUP_KEY);
      }
    } catch (err) {
      console.warn("No se pudo respaldar la cola antes del login Spotify", err);
    }
    window.location.href = "/api/spotify/login";
  };

  const handleSpotifyLogout = async () => {
    let logoutSucceeded = false;

    try {
      const response = await fetch("/api/spotify/logout", { method: "POST" });
      logoutSucceeded = response.ok;
    } finally {
      if (logoutSucceeded) {
        const currentSnapshot = actions.getState();
        const currentTrack = currentSnapshot.currentTrack;

        if (currentTrack && isSpotifyTrack(currentTrack)) {
          try {
            await actions.pause();
          } catch {
            // ignore
          }
        }

        const spotifyTrackIds = currentSnapshot.queue
          .filter(isSpotifyTrack)
          .map((track) => track.id);

        for (const trackId of spotifyTrackIds) {
          actions.removeTrack(trackId, "trackId");
        }
      }

      // Refresh local session view even if request fails.
      await spotifySession.refresh();
    }
  };

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {/* Sidebar fija */}
        <aside className="fixed left-0 top-0 hidden h-full w-16 flex-col items-center justify-between border-r border-[var(--line)] bg-[var(--surface)] py-6 sm:flex">
          <div className="flex flex-col items-center gap-4">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--background)]">
              T
            </div>
              <nav className="flex flex-col items-center gap-3 text-[var(--muted)]">
                {/* Descubrimiento */}
                <SidebarIcon icon={Home} label="Inicio" active={activeView === "home"} onClick={() => setActiveView("home")} />
                <SidebarIcon icon={Search} label="Buscar" active={activeView === "search"} onClick={() => setActiveView("search")} />
              
              <hr className="my-1 w-8 border-[var(--line)] opacity-50" />

                {/* Formatos */}
                <SidebarIcon icon={Radio} label="Géneros" active={activeView === "genres"} onClick={() => setActiveView("genres")} />
              
              <hr className="my-1 w-8 border-[var(--line)] opacity-50" />

              {/* Personal */}
              <SidebarIcon icon={Star} label="Favoritos" active={activeView === "favorites"} onClick={() => setActiveView("favorites")} />
              <SidebarIcon icon={ListMusic} label="Playlists" active={activeView === "playlists"} onClick={() => setActiveView("playlists")} />
              <SidebarIcon icon={FolderOpen} label="Biblioteca" active={activeView === "library"} onClick={() => setActiveView("library")} />
              
              <hr className="my-1 w-8 border-[var(--line)] opacity-50" />
              
              {/* Reproductor */}
              <SidebarIcon icon={Play} label="Reproductor" active={activeView === "nowplaying"} onClick={() => setActiveView("nowplaying")} />
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
        <section className="ml-0 flex min-h-screen flex-col bg-[var(--background)] pb-16 sm:ml-16">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                Tarium
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl sm:text-3xl">
                Tu reproductor de música local
              </h1>
            </div>

            <div className="flex items-center gap-4">

              <div className="hidden items-center gap-2 sm:flex">
                {spotifySession.status === "connected" ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--muted)]">
                      {spotifySession.me.avatarUrl ? (
                        <img
                          src={spotifySession.me.avatarUrl}
                          alt={spotifySession.me.displayName ?? "Spotify"}
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="max-w-[10rem] truncate">
                        {spotifySession.me.displayName ?? "Spotify conectado"}
                      </span>
                    </div>

                    <Button size="sm" variant="outline" onClick={() => void handleSpotifyLogout()}>
                      Logout Spotify
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={spotifySession.status === "loading"}
                    onClick={handleSpotifyLogin}
                  >
                    {spotifySession.status === "loading" ? "Spotify..." : "Conectar con Spotify"}
                  </Button>
                )}
              </div>

              <ThemeToggleButton />
              {user ? (
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] text-xs sm:hidden"
                  onClick={signOut}
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] sm:hidden"
                  onClick={() => setAuthModalOpen(true)}
                >
                  <User size={16} />
                </button>
              )}
              {user ? (
                <div className="hidden items-center gap-2 text-xs text-[var(--muted)] sm:flex">
                  <User size={16} />
                  <span className="max-w-[10rem] truncate">{user.email}</span>
                </div>
              ) : null}
            </div>
          </header>

          {spotifyPlaybackNotice ? (
            <div className="mx-4 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:mx-6">
              {spotifyPlaybackNotice}
            </div>
          ) : null}

          {/* Área principal */}
          <div className="flex flex-1 flex-col gap-4 bg-[var(--background)] px-4 pt-4 pb-32 sm:px-6 sm:pb-24">
            <div className="grid gap-4 grid-cols-1">
              {/* Columna unica: vistas dinámicas */}
              <div className="flex flex-col gap-4">
                {activeView === "nowplaying" ? (
                  <NowPlayingView />
                ) : activeView === "home" ? (
                  <HomeView
                    session={spotifySession}
                  />
                ) : activeView === "genres" ? (
                  <GenresView spotifyConnected={spotifySession.status === "connected"} />
                ) : activeView === "search" ? (
                  <SearchView />
                ) : (<> 
                {/* Vista principal / biblioteca según activeView */}
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {false && (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                            Reproduciendo ahora
                          </p>
                           <h2 className="mt-2 truncate font-[family-name:var(--font-cormorant)] text-4xl sm:text-5xl">
                             {currentTrack?.title ?? "Ningún track seleccionado"}
                           </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {currentTrack?.artist ?? "Carga archivos o añade pistas a la cola"}
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
                     {false && currentTrack && (
                      <div className="hidden h-40 w-40 flex-shrink-0 overflow-hidden rounded-2xl border border-[var(--line)] sm:block">
                        <img
                          src={currentTrack?.thumbnailUrl ?? "/placeholder.png"}
                          alt={currentTrack?.title ?? "Track"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {false && (
                    <>
                      <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
                        <div className="flex items-center gap-2">
                          <Clock3 size={14} />
                          <span>
                            {formatDuration(
                              isSeeking ? (seekValue ?? displayProgress) : displayProgress,
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
                            ? [isSeeking ? (seekValue ?? displayProgress) : displayProgress]
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
                {activeView === "library" && (
                  <LibraryView
                    queue={queue}
                    currentTrackQueueItemId={currentTrackQueueItemId}
                    authenticated={Boolean(user)}
                    favoritedIds={favoritedIds}
                    playlists={playlists}
                    onReorder={(newQueue) => actions.setQueue(newQueue)}
                    onPlayTrack={(queueItemId) => {
                      const selected = queue.find(
                        (track) => (track.queueItemId ?? track.id) === queueItemId,
                      );
                      if (!ensureSpotifyPlaybackAllowed(selected)) return;
                      void actions.playByQueueItemId(queueItemId).catch((err) => {
                        handlePlaybackError(err, selected);
                      });
                    }}
                    onRemoveTrack={(queueItemId) => {
                      actions.removeTrack(queueItemId, "queueItemId");
                    }}
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

                      // Si esa playlist esta seleccionada, refrescar la lista visible.
                      if (selectedPlaylistId === playlistId) {
                        const updated = await getPlaylistTracks(playlistId);
                        setPlaylistTracks(updated);
                      }
                    }}
                    onTracksParsed={handleLocalDropzoneTracksParsed}
                  />
                )}
                {activeView === "favorites" && (
                  <FavoritesView
                    favorites={favorites}
                    authenticated={Boolean(user)}
                    spotifyFavIds={spotifyFavIds}
                    onPlayFavorite={(fav) => {
                      const trackInQueue = queue.find((t) => t.id === fav.track_id);
                      if (trackInQueue) {
                        if (!ensureSpotifyPlaybackAllowed(trackInQueue)) return;
                        const queueItemId = trackInQueue.queueItemId ?? trackInQueue.id;
                        void actions.playByQueueItemId(queueItemId).catch((err) => {
                          handlePlaybackError(err, trackInQueue);
                        });
                        return;
                      }

                      const mapped = mapFavoriteToITrack(fav);
                      if (!ensureSpotifyPlaybackAllowed(mapped)) return;
                      const inserted = actions.addTrack(mapped);
                      const queueItemId = inserted.queueItemId ?? inserted.id;
                      void actions.playByQueueItemId(queueItemId).catch((err) => {
                        handlePlaybackError(err, mapped);
                      });
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
                    favoritedIds={favoritedIds}
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
                    onToggleFavorite={async (track) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }

                      const favorite = isFavorite(track.track_id);
                      if (favorite) {
                        await removeFavorite(track.track_id);
                        return;
                      }

                      await addFavorite({
                        track_id: track.track_id,
                        title: track.title,
                        artist: track.artist,
                        thumbnail_url: track.thumbnail_url,
                      });
                    }}
                    onReorderTracks={(playlistId, newTracks) => {
                      if (selectedPlaylistId !== playlistId) return;
                      setPlaylistTracks(newTracks);
                      void reorderPlaylistTracks(
                        playlistId,
                        newTracks.map((track) => track.id),
                      );
                    }}
                    spotifyConnected={spotifySession.status === "connected"}
                    onImportSpotifyPlaylist={async (name, tracks) => {
                      if (!user) {
                        setAuthModalOpen(true);
                        return;
                      }
                      const pl = await createPlaylist(name);
                      if (!pl) return;
                      for (const t of tracks) {
                        await addTrackToPlaylist(pl.id, {
                          track_id: t.id,
                          title: t.title,
                          artist: t.artist,
                          thumbnail_url: t.thumbnailUrl,
                          duration_seconds: t.durationInSeconds,
                        });
                      }
                    }}
                  />
                )}
                </>)}
              </div>
            </div>
          </div>

          {/* Barra de reproducción inferior fija */}
          <nav
            className="fixed left-0 right-0 z-40 flex items-center gap-6 overflow-x-auto border-t border-[var(--line)] bg-[var(--surface)] px-6 py-2 sm:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <MobileNavIcon icon={Home} label="Inicio" active={activeView === "home"} onClick={() => setActiveView("home")} />
            <MobileNavIcon icon={Search} label="Buscar" active={activeView === "search"} onClick={() => setActiveView("search")} />
            <MobileNavIcon icon={Radio} label="Géneros" active={activeView === "genres"} onClick={() => setActiveView("genres")} />
            <MobileNavIcon icon={Star} label="Favs" active={activeView === "favorites"} onClick={() => setActiveView("favorites")} />
            <MobileNavIcon icon={ListMusic} label="Listas" active={activeView === "playlists"} onClick={() => setActiveView("playlists")} />
            <MobileNavIcon icon={FolderOpen} label="Local" active={activeView === "library"} onClick={() => setActiveView("library")} />
            <MobileNavIcon icon={Play} label="Actual" active={activeView === "nowplaying"} onClick={() => setActiveView("nowplaying")} />
          </nav>
          <footer
            className="fixed bottom-0 left-0 right-0 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-3 sm:left-16 sm:h-16 sm:gap-4 sm:px-6"
            style={{
              minHeight: "4.75rem",
              paddingTop: "0.75rem",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)",
            }}
          >
            {/* Artwork + info */}
            <div className="flex min-w-0 flex-[2] items-center gap-2 sm:gap-3">
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
                    className={`ml-1 hidden h-8 w-8 items-center justify-center rounded-full border text-[var(--muted)] sm:flex ${
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
                          className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed sm:flex"
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
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading}
                  onClick={() => {
                    const candidate = getPreviousTrackCandidate();
                    if (!ensureSpotifyPlaybackAllowed(candidate)) return;
                    void actions.playPrevious().catch((err) => {
                      handlePlaybackError(err, candidate);
                    });
                  }}
                  className="text-[var(--foreground)]"
                >
                  <SkipBack size={18} />
                </Button>
                <Button
                  size="lg"
                  className="h-12 w-12 shrink-0 rounded-full px-0 leading-none bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:text-white active:bg-[var(--accent-active)] sm:h-10 sm:min-w-24 sm:px-5"
                  disabled={state.loading || !currentTrack}
                  onClick={() => {
                    if (!state.isPlaying && !ensureSpotifyPlaybackAllowed(currentTrack)) return;
                    void actions.togglePlayPause().catch((err) => {
                      handlePlaybackError(err, currentTrack);
                    });
                  }}
                >
                  {state.loading ? "Cargando" : state.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading || queue.length < 2}
                  onClick={handleShuffleClick}
                  className={`${queue.length >= 2 ? "text-[var(--foreground)]" : "text-[var(--muted)]"} hidden sm:inline-flex`}
                >
                  <Shuffle size={18} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading}
                  onClick={() => actions.cycleRepeatMode()}
                  className={`${state.repeatMode === "off" ? "text-[var(--muted)]" : "text-[var(--accent)]"} hidden sm:inline-flex`}
                >
                  {state.repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={state.loading}
                  onClick={() => {
                    const candidate = getNextTrackCandidate();
                    if (!ensureSpotifyPlaybackAllowed(candidate)) return;
                    void actions.playNext().catch((err) => {
                      handlePlaybackError(err, candidate);
                    });
                  }}
                  className="text-[var(--foreground)]"
                >
                  <SkipForward size={18} />
                </Button>
              </div>
              <div className="hidden w-full max-w-sm items-center gap-2 sm:flex">
                <span className="w-10 text-right text-[10px] text-[var(--muted)]">
                  {formatDuration(isSeeking ? (seekValue ?? displayProgress) : displayProgress)}
                </span>
                <Slider
                  value={
                    state.durationSeconds > 0
                      ? [isSeeking ? (seekValue ?? displayProgress) : displayProgress]
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
                />
                <span className="w-10 text-[10px] text-[var(--muted)]">{formatDuration(state.durationSeconds)}</span>
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
              id="playlist-name"
              name="playlist-name"
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

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer setState to avoid react-hooks/set-state-in-effect lint.
    queueMicrotask(() => setMounted(true));
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
