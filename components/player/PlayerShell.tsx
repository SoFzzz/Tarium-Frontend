"use client";

import { useEffect, useState } from "react";
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

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) {
    return "--:--";
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function PlayerShell() {
  const { state, actions } = usePlayer();
  const { user, signOut } = useAuth();
  const { playlists, createPlaylist, getPlaylistTracks, addTrackToPlaylist, removeTrackFromPlaylist, deletePlaylist } = usePlaylists();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  
  const [activeView, setActiveView] = useState<"home" | "library" | "favorites" | "playlists">("home");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[] | null>(null);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  
  const currentTrack = state.currentTrack;
  const queue = state.queue;
  const currentTrackId = currentTrack?.id ?? null;
  const isCurrentTrackFavorite = currentTrack ? isFavorite(currentTrack.id) : false;

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

  const handleCreatePlaylist = async () => {
    const name = window.prompt("Nombre de la nueva playlist");
    if (!name || !name.trim()) return;
    try {
      await createPlaylist(name.trim());
    } catch (err) {
      console.error("Error creating playlist:", err);
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

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!window.confirm("¿Eliminar esta playlist?")) return;
    try {
      await deletePlaylist(playlistId);
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(null);
        setPlaylistTracks(null);
      }
    } catch (err) {
      console.error("Error deleting playlist:", err);
    }
  };

  const handleToggleShuffle = () => {
    if (!isShuffleEnabled) {
      if (queue.length >= 2) {
        actions.shuffle();
      }
      setIsShuffleEnabled(true);
    } else {
      setIsShuffleEnabled(false);
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
            {user && (
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
                            {formatDuration(state.progressSeconds)} / {formatDuration(state.durationSeconds)}
                          </span>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <ListMusic size={14} />
                          <span>{queue.length} en cola</span>
                        </div>
                      </div>

                      <Slider
                        value={state.durationSeconds > 0 ? [state.progressSeconds] : [0]}
                        max={state.durationSeconds || 0}
                        step={1}
                        disabled={state.durationSeconds <= 0}
                        onValueChange={([val]) => actions.seek(val)}
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
                    onPlayTrack={(id) => void actions.playById(id)}
                    onToggleFavorite={async (track) => {
                      if (!track) return;
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
                  />
                )}
                {activeView === "favorites" && (
                  <FavoritesView
                    favorites={favorites}
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
                      await removeFavorite(fav.track_id);
                    }}
                  />
                )}
                {activeView === "playlists" && (
                  <PlaylistsView
                    playlists={playlists}
                    selectedPlaylistId={selectedPlaylistId}
                    playlistTracks={playlistTracks}
                    loadingTracks={loadingPlaylistTracks}
                    onSelectPlaylist={handleSelectPlaylist}
                    onCreatePlaylist={handleCreatePlaylist}
                    onPlayTrack={handlePlayPlaylistTrack}
                    onPlayAll={handlePlayEntirePlaylist}
                    onRemoveTrack={handleRemoveTrackFromPlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
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
                <button
                  type="button"
                  className={`ml-1 flex h-8 w-8 items-center justify-center rounded-full border text-[var(--muted)] ${
                    isCurrentTrackFavorite ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)]"
                  }`}
                  onClick={handleAddToFavorites}
                >
                  <Heart
                    size={16}
                    fill={isCurrentTrackFavorite ? "currentColor" : "none"}
                  />
                </button>
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
                  onClick={() => actions.shuffle()}
                  className={queue.length >= 2 ? "text-[var(--accent)]" : "text-[var(--muted)]"}
                >
                  <Shuffle size={18} />
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
                <span className="w-7 text-right">{state.volume}</span>
              </div>
              <Slider
                value={[state.volume]}
                max={100}
                step={1}
                onValueChange={([val]) => actions.setVolume(val)}
                className="w-24"
              />
              <div className="hidden flex-col items-end text-xs text-[var(--muted)] md:flex">
                <span>{formatDuration(state.progressSeconds)}</span>
                <span>{formatDuration(state.durationSeconds)}</span>
              </div>
            </div>
          </footer>
        </section>
      </main>
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
