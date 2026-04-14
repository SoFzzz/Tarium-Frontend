"use client";

import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { type ITrack } from "@/lib/player/types";
import { usePlayer } from "@/providers/PlayerProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useFavorites } from "@/hooks/useFavorites";
import { Clock3, ListMusic, Heart, Trash2, GripVertical } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AuthModalControlled } from "@/components/auth/AuthModal";
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

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return "--:--";
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function NowPlayingView() {
  const { state, actions } = usePlayer();
  const { user } = useAuth();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  const currentTrack = state.currentTrack;
  const currentTrackId = currentTrack?.id ?? null;
  const queue = state.queue;
  const displayProgress = state.progressSeconds;

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const handleToggleFavorite = async (track: ITrack) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (isFavorite(track.id)) {
      await removeFavorite(track.id);
    } else {
      await addFavorite({
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        thumbnail_url: track.thumbnailUrl,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
            Reproduciendo ahora
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="mx-auto hidden h-56 w-56 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface-elevated)] sm:block lg:mx-0 lg:h-64 lg:w-64">
              {currentTrack ? (
                <img
                  src={currentTrack.thumbnailUrl}
                  alt={currentTrack.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
                  Sin artwork
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mx-auto mb-4 block h-32 w-32 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] sm:hidden">
                {currentTrack ? (
                  <img
                    src={currentTrack.thumbnailUrl}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
                    Sin artwork
                  </div>
                )}
              </div>
              <h2 className="font-[family-name:var(--font-cormorant)] text-4xl sm:text-5xl">
                {currentTrack ? currentTrack.title : "Ningun track seleccionado"}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
                {currentTrack ? currentTrack.artist : "Reproduce algo genial hoy"}
              </p>
              <div className="mt-6 flex items-center justify-between text-xs text-[var(--muted)]">
                <div className="flex items-center gap-2">
                  <Clock3 size={14} />
                  <span>
                    {formatDuration(isSeeking ? seekValue : displayProgress)} / {formatDuration(state.durationSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ListMusic size={14} />
                  <span>{queue.length} en cola</span>
                </div>
              </div>
              <Slider
                value={state.durationSeconds > 0 ? [isSeeking ? seekValue : displayProgress] : [0]}
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
                  actions.seek(val);
                }}
                className="mt-3 w-full"
              />
            </div>
          </div>
        </div>
      </div>
      
      <NowPlayingQueuePanel
        queue={queue}
        currentTrackId={currentTrackId}
        authenticated={Boolean(user)}
        isFavorite={isFavorite}
        onPlayTrack={(id) => void actions.playById(id)}
        onReorder={(newQueue) => actions.setQueue(newQueue)}
        onRemoveTrack={(id) => actions.removeTrack(id)}
        onToggleFavorite={handleToggleFavorite}
      />
      <AuthModalControlled open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

// ---- Queue specific logic moved from PlayerShell ----

type NowPlayingQueuePanelProps = {
  queue: ITrack[];
  currentTrackId: string | null;
  authenticated: boolean;
  isFavorite: (trackId: string) => boolean;
  onPlayTrack: (id: string) => void;
  onReorder: (newQueue: ITrack[]) => void;
  onRemoveTrack: (id: string) => void;
  onToggleFavorite: (track: ITrack) => Promise<void>;
};

function NowPlayingQueuePanel({
  queue, currentTrackId, authenticated, isFavorite, onPlayTrack, onReorder, onRemoveTrack, onToggleFavorite
}: NowPlayingQueuePanelProps) {
  const [orderedQueue, setOrderedQueue] = useState<ITrack[]>(queue);

  useEffect(() => {
    setOrderedQueue(queue);
  }, [queue]);

  const ids = useMemo(() => orderedQueue.map((t) => t.id), [orderedQueue]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedQueue.findIndex((t) => t.id === active.id);
    const newIndex = orderedQueue.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedQueue, oldIndex, newIndex);
    setOrderedQueue(next);
    Promise.resolve().then(() => onReorder(next));
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 flex flex-col max-h-[85vh]">
      <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
            Cola actual
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Reordena, marca favoritos o elimina tracks de la cola
          </p>
        </div>
        <span className="text-xs text-[var(--muted)]">{queue.length} tracks</span>
      </div>

      {orderedQueue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)] shrink-0">
          La cola está vacía. Suma nuevas canciones para empezar la fiesta.
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
                  <SortableRow
                    key={track.id}
                    track={track}
                    currentTrackId={currentTrackId}
                    authenticated={authenticated}
                    isFav={isFavorite(track.id)}
                    onPlayTrack={onPlayTrack}
                    onRemoveTrack={onRemoveTrack}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function SortableRow({
  track, currentTrackId, authenticated, isFav, onPlayTrack, onRemoveTrack, onToggleFavorite
}: { track: ITrack; currentTrackId: string | null; authenticated: boolean; isFav: boolean; onPlayTrack: (id: string) => void; onRemoveTrack: (id: string) => void; onToggleFavorite: (track: ITrack) => Promise<void>; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrent = track.id === currentTrackId;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ${
        isCurrent ? "bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--accent)]" : "hover:bg-[var(--surface-elevated)]"
      } ${isDragging ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        aria-label="Reordenar"
        className="flex h-8 w-8 touch-none items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical size={16} />
      </button>

      <button type="button" className="flex flex-1 items-center gap-3 text-left min-w-0" onClick={() => onPlayTrack(track.id)}>
        <img src={track.thumbnailUrl} alt={track.title} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-semibold ${isCurrent ? "text-[var(--accent)]" : ""}`}>{track.title}</p>
          <p className="truncate text-[11px] text-[var(--muted)]">{track.artist}</p>
        </div>
      </button>

      <div className="flex gap-1 shrink-0 px-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
            authenticated
              ? isFav ? "border-[var(--brand-accent-rgb)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--muted)] opacity-40"
          }`}
          onClick={(e) => { e.stopPropagation(); void onToggleFavorite(track); }}
        >
          <Heart size={14} fill={isFav ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500"
          onClick={(e) => { e.stopPropagation(); onRemoveTrack(track.id); }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
