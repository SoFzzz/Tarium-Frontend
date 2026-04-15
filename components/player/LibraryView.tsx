"use client";

import { Check, ChevronDown, Heart, GripVertical, Plus, Upload, Trash2 } from "lucide-react";

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

import type { ITrack, LocalTrack } from "@/lib/player/types";
import type { Playlist } from "@/hooks/usePlaylists";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LocalLibraryDropzone } from "@/components/LocalLibraryDropzone";

type Props = {
  queue: ITrack[];
  currentTrackQueueItemId: string | null;
  authenticated?: boolean;
  favoritedIds?: Set<string>;
  playlists?: Playlist[];
  onReorder?: (newQueue: ITrack[]) => void;
  onPlayTrack: (queueItemId: string) => void;
  onRemoveTrack?: (queueItemId: string) => void;
  onToggleFavorite: (track: ITrack | null) => void | Promise<void>;
  onAddTrackToPlaylist?: (playlistId: string, track: ITrack) => Promise<void> | void;
  onTracksParsed: (tracks: LocalTrack[]) => void;
};

export function LibraryView({
  queue,
  currentTrackQueueItemId,
  authenticated,
  favoritedIds,
  playlists,
  onReorder,
  onPlayTrack,
  onRemoveTrack,
  onToggleFavorite,
  onAddTrackToPlaylist,
  onTracksParsed,
}: Props) {
  const [orderedQueue, setOrderedQueue] = useState<ITrack[]>(queue);

  useEffect(() => {
    setOrderedQueue(queue);
  }, [queue]);

  const ids = useMemo(
    () => orderedQueue.map((t) => t.queueItemId ?? t.id),
    [orderedQueue],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    const oldIndex = orderedQueue.findIndex((t) => (t.queueItemId ?? t.id) === active.id);
    const newIndex = orderedQueue.findIndex((t) => (t.queueItemId ?? t.id) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedQueue, oldIndex, newIndex);
    setOrderedQueue(next);
    if (onReorder) {
      Promise.resolve().then(() => onReorder(next));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
      {/* Left: Dropzone */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
          Importar archivos
        </p>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--line)] text-[var(--muted)]">
            <Upload size={28} />
          </div>
          <LocalLibraryDropzone onTracksParsed={onTracksParsed} />
        </div>
      </div>

      {/* Right: Track list */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 flex flex-col max-h-[85vh]">
        <div className="mb-3 flex items-center justify-between shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
            Biblioteca local ({queue.length})
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--muted)] px-4 py-6">
            Todavía no has cargado archivos. Arrastra tus archivos de audio en el panel de la izquierda.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1 text-xs">
                  {orderedQueue.map((track) => (
                    <SortableLibraryRow
                      key={track.queueItemId ?? track.id}
                      track={track}
                      currentTrackQueueItemId={currentTrackQueueItemId}
                      authenticated={authenticated}
                      isFav={Boolean(favoritedIds?.has(track.id))}
                      playlists={playlists}
                      onPlayTrack={onPlayTrack}
                      onRemoveTrack={onRemoveTrack}
                      onToggleFavorite={onToggleFavorite}
                      onAddTrackToPlaylist={onAddTrackToPlaylist}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableLibraryRow({
  track,
  currentTrackQueueItemId,
  authenticated,
  isFav,
  playlists,
  onPlayTrack,
  onRemoveTrack,
  onToggleFavorite,
  onAddTrackToPlaylist,
}: {
  track: ITrack;
  currentTrackQueueItemId: string | null;
  authenticated?: boolean;
  isFav: boolean;
  playlists?: Playlist[];
  onPlayTrack: (queueItemId: string) => void;
  onRemoveTrack?: (queueItemId: string) => void;
  onToggleFavorite: (track: ITrack | null) => void | Promise<void>;
  onAddTrackToPlaylist?: (playlistId: string, track: ITrack) => Promise<void> | void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.queueItemId ?? track.id,
  });

  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [addedToPlaylist, setAddedToPlaylist] = useState(false);

  useEffect(() => {
    if (!playlistMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlaylistMenuOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("[data-playlist-menu-container]");
      if (!el) setPlaylistMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [playlistMenuOpen]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const queueItemId = track.queueItemId ?? track.id;
  const isCurrent = queueItemId === currentTrackQueueItemId;
  const canAddToPlaylist = Boolean(authenticated && onAddTrackToPlaylist && playlists && playlists.length > 0);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--surface-elevated)] ${
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
        className="flex flex-1 items-center gap-3 text-left"
        onClick={() => onPlayTrack(queueItemId)}
      >
        <img
          src={track.thumbnailUrl}
          alt={track.title}
          className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-semibold ${isCurrent ? "text-[var(--accent)]" : ""}`}>
            {track.title}
          </p>
          <p className="truncate text-[11px] text-[var(--muted)]">{track.artist}</p>
        </div>
      </button>

      {onRemoveTrack ? (
        <button
          type="button"
          aria-label="Eliminar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500 sm:h-7 sm:w-7"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveTrack(queueItemId);
          }}
        >
          <Trash2 size={13} />
        </button>
      ) : null}

      {authenticated ? (
        <div className="relative" data-playlist-menu-container>
          <button
            type="button"
            className={`flex h-9 items-center justify-center gap-1 rounded-full border px-2 text-[11px] transition-colors sm:h-7 ${
              canAddToPlaylist
                ? "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                : "border-[var(--line)] text-[var(--muted)] opacity-40 cursor-not-allowed"
            }`}
            disabled={!canAddToPlaylist || addingToPlaylist}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!canAddToPlaylist) return;
              setPlaylistMenuOpen((prev) => !prev);
            }}
            aria-haspopup="menu"
            aria-expanded={playlistMenuOpen}
            title={canAddToPlaylist ? "Agregar a playlist" : "Crea una playlist para guardar"}
          >
            {addedToPlaylist ? <Check size={14} /> : <Plus size={14} />}
            <ChevronDown size={12} className="opacity-70" />
          </button>

          {playlistMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl"
            >
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                Agregar a
              </div>
              <div className="max-h-56 overflow-y-auto">
                {(playlists ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!onAddTrackToPlaylist) return;
                      try {
                        setAddingToPlaylist(true);
                        await onAddTrackToPlaylist(p.id, track);
                        setAddedToPlaylist(true);
                        setPlaylistMenuOpen(false);
                        window.setTimeout(() => setAddedToPlaylist(false), 1200);
                      } finally {
                        setAddingToPlaylist(false);
                      }
                    }}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {authenticated ? (
        <button
          type="button"
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors sm:h-7 sm:w-7 ${
            isFav
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          }`}
          onClick={() => onToggleFavorite(track)}
        >
          <Heart size={13} fill={isFav ? "currentColor" : "none"} />
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
                <Heart size={13} />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Inicia sesión para guardar</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}
