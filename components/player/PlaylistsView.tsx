"use client";

import { Play, Trash2 } from "lucide-react";

import type { Playlist, PlaylistTrack } from "@/hooks/usePlaylists";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  playlists: Playlist[];
  authenticated?: boolean;
  selectedPlaylistId: string | null;
  playlistTracks: PlaylistTrack[] | null;
  loadingTracks: boolean;
  onSelectPlaylist: (id: string) => void | Promise<void>;
  onCreatePlaylist: () => void | Promise<void>;
  onPlayTrack: (track: PlaylistTrack) => void | Promise<void>;
  onPlayAll: () => void | Promise<void>;
  onRemoveTrack: (track: PlaylistTrack) => void | Promise<void>;
  onDeletePlaylist: (playlistId: string) => void;
  onAddCurrentTrack?: () => void | Promise<void>;
  canAddCurrentTrack?: boolean;
};

export function PlaylistsView({
  playlists,
  authenticated,
  selectedPlaylistId,
  playlistTracks,
  loadingTracks,
  onSelectPlaylist,
  onCreatePlaylist,
  onPlayTrack,
  onPlayAll,
  onRemoveTrack,
  onDeletePlaylist,
  onAddCurrentTrack,
  canAddCurrentTrack,
}: Props) {
  const isAuthed = Boolean(authenticated);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
          Playlists
        </p>
        {isAuthed ? (
          <Button size="sm" onClick={onCreatePlaylist}>
            Nueva playlist
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" disabled className="opacity-40 cursor-not-allowed">
                  Nueva playlist
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Inicia sesión para guardar</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex gap-4 text-xs">
        <div className="w-1/3 border-r border-[var(--line)] pr-3">
          {!isAuthed ? (
            <p className="text-[var(--muted)]">Inicia sesión para guardar tus playlists y favoritos</p>
          ) : playlists.length === 0 ? (
            <p className="text-[var(--muted)]">Todavía no tienes playlists.</p>
          ) : (
            <ul className="space-y-1">
              {playlists.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`flex w-full flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-elevated)] ${
                      selectedPlaylistId === p.id ? "bg-[var(--surface-elevated)]" : ""
                    }`}
                    onClick={() => onSelectPlaylist(p.id)}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                  {isAuthed ? (
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500"
                      onClick={() => onDeletePlaylist(p.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <button
                            type="button"
                            disabled
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed"
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Inicia sesión para guardar</TooltipContent>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex-1 pl-1">
          {!isAuthed ? (
            <p className="text-[var(--muted)] text-sm text-center mt-4">Inicia sesión para guardar tus playlists y favoritos</p>
          ) : loadingTracks ? (
            <p className="text-[var(--muted)]">Cargando canciones…</p>
          ) : !selectedPlaylistId ? (
            <p className="text-[var(--muted)]">Selecciona una playlist para ver sus canciones.</p>
          ) : !playlistTracks || playlistTracks.length === 0 ? (
            <p className="text-[var(--muted)]">Esta playlist está vacía.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <Button size="sm" variant="outline" onClick={() => onPlayAll()}>
                  Reproducir playlist
                </Button>
                {onAddCurrentTrack && canAddCurrentTrack ? (
                  <Button size="sm" variant="ghost" onClick={() => onAddCurrentTrack()}>
                    Agregar track actual
                  </Button>
                ) : null}
              </div>
              <ul className="space-y-1">
                {playlistTracks.map((t) => (
                  <li key={t.id}>
                    <div
                      className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--surface-elevated)]"
                      onClick={() => onPlayTrack(t)}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[var(--muted)] group-hover:text-[var(--accent)]">
                        <Play size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{t.title}</p>
                        <p className="truncate text-[11px] text-[var(--muted)]">{t.artist}</p>
                      </div>
                      {isAuthed ? (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onRemoveTrack(t);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <button
                                type="button"
                                disabled
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed"
                              >
                                <Trash2 size={13} />
                              </button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Inicia sesión para guardar</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
