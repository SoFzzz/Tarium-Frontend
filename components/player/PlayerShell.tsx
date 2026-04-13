"use client";

import { Button, Chip, Slider, Spinner, Table, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import {
  Clock3,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  Heart,
  LogOut,
  User,
} from "lucide-react";

import { usePlayer } from "@/providers/PlayerProvider";
import { useAuth } from "@/providers/AuthProvider";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { useState } from "react";

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
  const { playlists, createPlaylist } = usePlaylists();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  
  const currentTrack = state.currentTrack;
  const queue = state.queue;
  const currentTrackId = currentTrack?.id ?? null;
  const isCurrentTrackFavorite = currentTrack ? isFavorite(currentTrack.id) : false;

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
    if (!newPlaylistName.trim()) return;
    try {
      await createPlaylist(newPlaylistName);
      setNewPlaylistName("");
      setShowNewPlaylistInput(false);
    } catch (err) {
      console.error("Error creating playlist:", err);
    }
  };

  if (currentTrack === null) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <section className="fade-rise w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[var(--surface)] p-10 text-center shadow-[var(--shadow)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--muted)]">
            Tarium
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl leading-none text-[var(--foreground)]">
            The queue is quiet.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
            Seed a playlist and the full player workspace will appear here with transport
            controls, artwork, and queue navigation.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="player-shell relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          alt=""
          src={currentTrack.thumbnailUrl}
          className="h-full w-full scale-110 object-cover opacity-[0.18] blur-3xl"
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(16,12,14,0.92)_0%,rgba(16,12,14,0.58)_45%,rgba(16,12,14,0.96)_100%)]" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--surface)] shadow-[var(--shadow)] backdrop-blur-2xl lg:grid lg:grid-cols-[1.3fr_0.9fr]">
        <div className="relative flex flex-col justify-between border-b border-white/8 px-6 py-6 sm:px-8 sm:py-8 lg:border-b-0 lg:border-r">
          <header className="fade-rise flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[var(--muted)]">
                Tarium
              </p>
              <h1 className="mt-3 max-w-md font-[family-name:var(--font-cormorant)] text-4xl leading-[0.9] text-[var(--foreground)] sm:text-6xl">
                Your listening room, staged like a headline.
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Chip className="border-white/10 bg-white/8 text-[var(--foreground)]" variant="soft">
                {state.loading ? "Preparing playback" : "Queue live"}
              </Chip>

              {user && (
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      variant="light"
                      className="text-[var(--foreground)]"
                    >
                      <User size={18} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="User menu"
                    className="bg-[var(--surface)] border border-white/10"
                  >
                    <DropdownItem key="user" isReadOnly className="text-xs">
                      {user.email}
                    </DropdownItem>
                    <DropdownItem key="signout" onClick={signOut}>
                      <div className="flex items-center gap-2">
                        <LogOut size={14} />
                        Cerrar sesión
                      </div>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </header>

          <div className="mt-8 grid flex-1 items-center gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="fade-rise relative mx-auto flex w-full max-w-[440px] items-center justify-center xl:mx-0">
              <div className="artwork-glow" />
              <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-white/12 bg-[var(--surface-strong)] shadow-2xl">
                <img
                  key={currentTrack.id}
                  src={currentTrack.thumbnailUrl}
                  alt={`${currentTrack.title} cover artwork`}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
                />
              </div>
            </div>

            <div className="fade-rise">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                <Sparkles size={14} />
                <span>Now playing</span>
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  {currentTrack.artist}
                </p>
                <h2 className="mt-3 max-w-xl font-[family-name:var(--font-cormorant)] text-5xl leading-[0.92] text-[var(--foreground)] sm:text-7xl">
                  {currentTrack.title}
                </h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)] sm:text-base">
                  A focused playback workspace with the queue, transport, and volume all in
                  view. Designed to feel closer to a listening suite than a dashboard.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                <Chip className="border-white/10 bg-white/8 text-[var(--foreground)]" variant="soft">
                  <Clock3 className="mr-2" size={14} />
                  {formatDuration(currentTrack.durationInSeconds)}
                </Chip>
                <Chip className="border-white/10 bg-white/8 text-[var(--foreground)]" variant="soft">
                  <ListMusic className="mr-2" size={14} />
                  {queue.length} tracks loaded
                </Chip>
                {currentTrack.album ? (
                  <Chip
                    className="border-white/10 bg-white/8 text-[var(--foreground)]"
                    variant="tertiary"
                  >
                    {currentTrack.album}
                  </Chip>
                ) : null}
              </div>

              {user && (
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    isIconOnly
                    variant="light"
                    className={`rounded-full ${
                      isCurrentTrackFavorite
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                    onPress={handleAddToFavorites}
                  >
                    <Heart
                      size={18}
                      fill={isCurrentTrackFavorite ? "currentColor" : "none"}
                    />
                  </Button>

                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        size="sm"
                        variant="tertiary"
                        className="rounded-full border border-white/10 bg-white/8 text-[var(--foreground)]"
                      >
                        Add to playlist
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Playlists"
                      className="bg-[var(--surface)] border border-white/10"
                    >
                      {playlists.length === 0 ? (
                        <DropdownItem key="empty" isReadOnly className="text-xs">
                          No playlists
                        </DropdownItem>
                      ) : (
                        playlists.map((playlist) => (
                          <DropdownItem
                            key={playlist.id}
                            textValue={playlist.name}
                            className="text-sm"
                          >
                            {playlist.name}
                          </DropdownItem>
                        ))
                      )}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              )}

              <div className="mt-10 flex flex-col gap-7">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    isIconOnly
                    variant="tertiary"
                    className="rounded-full border border-white/10 bg-white/8 text-[var(--foreground)]"
                    onPress={() => {
                      void actions.playPrevious();
                    }}
                    isDisabled={state.loading}
                  >
                    <SkipBack size={18} />
                  </Button>

                  <Button
                    size="lg"
                    className="min-w-40 rounded-full bg-[var(--accent)] px-8 font-semibold text-[#24160f] shadow-[0_14px_32px_rgba(255,142,69,0.28)] transition-transform duration-200 hover:scale-[1.02]"
                    onPress={() => {
                      void actions.togglePlayPause();
                    }}
                    isDisabled={state.loading}
                  >
                    {state.loading ? (
                      <>
                        <Spinner color="current" size="sm" />
                        Loading
                      </>
                    ) : state.isPlaying ? (
                      <>
                        <Pause size={18} />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        Play
                      </>
                    )}
                  </Button>

                  <Button
                    isIconOnly
                    variant="tertiary"
                    className="rounded-full border border-white/10 bg-white/8 text-[var(--foreground)]"
                    onPress={() => {
                      void actions.playNext();
                    }}
                    isDisabled={state.loading}
                  >
                    <SkipForward size={18} />
                  </Button>

                  <Button
                    variant="tertiary"
                    className="rounded-full border border-white/10 bg-transparent px-5 text-[var(--foreground)]"
                    onPress={() => actions.shuffle()}
                    isDisabled={state.loading || queue.length < 2}
                  >
                    Shuffle queue
                  </Button>
                </div>

                <div className="max-w-md rounded-[1.5rem] border border-white/8 bg-black/10 px-5 py-4">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    <div className="flex items-center gap-2">
                      <Volume2 size={14} />
                      <span>Volume</span>
                    </div>
                    <span>{state.volume}%</span>
                  </div>
                  <Slider
                    aria-label="Playback volume"
                    value={state.volume}
                    minValue={0}
                    maxValue={100}
                    step={1}
                    className="text-[var(--accent)]"
                    onChange={(value) => {
                      actions.setVolume(Array.isArray(value) ? value[0] ?? 0 : value);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="fade-rise flex min-h-0 flex-col px-4 py-4 sm:px-5 sm:py-5">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(12,10,12,0.22)] p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--muted)]">
                  Queue
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-cormorant)] text-3xl text-[var(--foreground)]">
                  Upcoming focus
                </h3>
              </div>
              <p className="max-w-[12rem] text-right text-xs leading-6 text-[var(--muted)]">
                Select any row to move it into the spotlight.
              </p>
            </div>

            <Table className="min-h-[26rem]">
              <Table.Content
                aria-label="Playback queue"
                selectionMode="single"
                selectedKeys={currentTrackId === null ? new Set([]) : new Set([currentTrackId])}
              >
                <Table.Header>
                  <Table.Column className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">
                    Track
                  </Table.Column>
                  <Table.Column className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">
                    Status
                  </Table.Column>
                  <Table.Column className="text-right text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">
                    Length
                  </Table.Column>
                </Table.Header>

                <Table.Body>
                  {queue.map((track) => {
                    const isCurrent = track.id === currentTrackId;

                    return (
                      <Table.Row
                        id={track.id}
                        key={track.id}
                        className="queue-row border-b border-white/6"
                      >
                        <Table.Cell className="py-3">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 text-left"
                            onClick={() => {
                              void actions.playById(track.id);
                            }}
                          >
                            <img
                              src={track.thumbnailUrl}
                              alt={`${track.title} thumbnail`}
                              className="h-14 w-14 rounded-2xl object-cover"
                            />
                            <div className="min-w-0">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  isCurrent ? "text-[var(--foreground)]" : "text-white/82"
                                }`}
                              >
                                {track.title}
                              </p>
                              <p className="truncate text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                {track.artist}
                              </p>
                            </div>
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          {isCurrent ? (
                            <Chip
                              className="border border-[var(--accent)]/30 bg-[var(--accent)]/12 text-[var(--accent)]"
                              variant="soft"
                            >
                              {state.loading ? "Loading" : state.isPlaying ? "Live" : "Paused"}
                            </Chip>
                          ) : (
                            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                              queued
                            </span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-right text-sm text-[var(--muted)]">
                          {formatDuration(track.durationInSeconds)}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table>
          </div>
        </aside>
      </section>
    </main>
  );
}
