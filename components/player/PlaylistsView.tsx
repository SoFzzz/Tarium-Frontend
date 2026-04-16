"use client";

import { GripVertical, Heart, Play, Trash2 } from "lucide-react";
import { canonicalTrackIdentity } from "@/lib/player/track-key";

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
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import React, { useEffect, useMemo, useState } from "react";

import type { Playlist, PlaylistTrack } from "@/hooks/usePlaylists";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  playlists: Playlist[];
  authenticated?: boolean;
  selectedPlaylistId: string | null;
  playlistTracks: PlaylistTrack[] | null;
  loadingTracks: boolean;
  favoritedIds: Set<string>;
  onSelectPlaylist: (id: string) => void | Promise<void>;
  onCreatePlaylist: () => void | Promise<void>;
  onPlayTrack: (track: PlaylistTrack) => void | Promise<void>;
  onPlayAll: () => void | Promise<void>;
  onRemoveTrack: (track: PlaylistTrack) => void | Promise<void>;
  onDeletePlaylist: (playlistId: string) => void;
  onAddCurrentTrack?: () => void | Promise<void>;
  canAddCurrentTrack?: boolean;
  onToggleFavorite: (track: PlaylistTrack) => void | Promise<void>;
  onReorderTracks: (playlistId: string, newTracks: PlaylistTrack[]) => void | Promise<void>;
};

export function PlaylistsView({
  playlists,
  authenticated,
  selectedPlaylistId,
  playlistTracks,
  loadingTracks,
  favoritedIds,
  onSelectPlaylist,
  onCreatePlaylist,
  onPlayTrack,
  onPlayAll,
  onRemoveTrack,
  onDeletePlaylist,
  onAddCurrentTrack,
  canAddCurrentTrack,
  onToggleFavorite,
  onReorderTracks,
}: Props) {
  const isAuthed = Boolean(authenticated);
  const [orderedTracks, setOrderedTracks] = useState<PlaylistTrack[]>(playlistTracks ?? []);

  useEffect(() => {
    setOrderedTracks(playlistTracks ?? []);
  }, [playlistTracks, selectedPlaylistId]);

  const ids = useMemo(() => orderedTracks.map((t) => t.id), [orderedTracks]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!selectedPlaylistId) return;
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = orderedTracks.findIndex((t) => t.id === active.id);
    const newIndex = orderedTracks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedTracks, oldIndex, newIndex);
    setOrderedTracks(next);

    Promise.resolve().then(() => void onReorderTracks(selectedPlaylistId, next));
  };

  return (
    <div className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-4 text-xs sm:flex-row">
          <div className="border-b border-[var(--line)] pb-3 sm:w-1/3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
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
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500 sm:h-7 sm:w-7"
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
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed sm:h-7 sm:w-7"
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
          <div className="flex-1 sm:pl-1">
            {!isAuthed ? (
              <p className="text-[var(--muted)] text-sm text-center mt-4">Inicia sesión para guardar tus playlists y favoritos</p>
            ) : loadingTracks ? (
              <p className="text-[var(--muted)]">Cargando canciones...</p>
            ) : !selectedPlaylistId ? (
              <p className="text-[var(--muted)]">Selecciona una playlist para ver sus canciones.</p>
            ) : !playlistTracks || playlistTracks.length === 0 ? (
              <p className="text-[var(--muted)]">Esta playlist está vacía.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto sm:max-h-64">
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-1 text-xs">
                      {orderedTracks.map((t) => (
                        <SortablePlaylistRow
                          key={t.id}
                          track={t}
                          isFav={
                            favoritedIds.has(t.track_id) ||
                            favoritedIds.has(canonicalTrackIdentity(t.track_id))
                          }
                          authenticated={isAuthed}
                          onPlayTrack={onPlayTrack}
                          onToggleFavorite={onToggleFavorite}
                          onRemoveTrack={onRemoveTrack}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortablePlaylistRow({
  track,
  isFav,
  authenticated,
  onPlayTrack,
  onToggleFavorite,
  onRemoveTrack,
}: {
  track: PlaylistTrack;
  isFav: boolean;
  authenticated: boolean;
  onPlayTrack: (track: PlaylistTrack) => void | Promise<void>;
  onToggleFavorite: (track: PlaylistTrack) => void | Promise<void>;
  onRemoveTrack: (track: PlaylistTrack) => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--surface-elevated)] ${
        isDragging ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Reordenar"
        className="flex h-9 w-9 touch-none items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing sm:h-7 sm:w-7"
        {...attributes}
        {...listeners}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical size={16} />
      </button>

      <button
        type="button"
        className="flex flex-1 items-center gap-2 text-left"
        onClick={() => void onPlayTrack(track)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[var(--muted)] group-hover:text-[var(--accent)]">
          <Play size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{track.title}</p>
          <p className="truncate text-[11px] text-[var(--muted)]">{track.artist}</p>
        </div>
      </button>

      {authenticated ? (
        <button
          type="button"
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors sm:h-7 sm:w-7 ${
            isFav
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            void onToggleFavorite(track);
          }}
          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Heart size={13} fill={isFav ? "currentColor" : "none"} />
        </button>
      ) : null}

      {authenticated ? (
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500 sm:h-7 sm:w-7"
          onClick={(event) => {
            event.stopPropagation();
            void onRemoveTrack(track);
          }}
          aria-label="Eliminar de playlist"
          title="Eliminar de playlist"
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed sm:h-7 sm:w-7"
              >
                <Trash2 size={13} />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Inicia sesión para guardar</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}
