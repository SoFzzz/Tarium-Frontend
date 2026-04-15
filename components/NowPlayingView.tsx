"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { GripVertical, Loader2, Trash2 } from "lucide-react";

import type { ITrack } from "@/lib/player/types";
import { fetchLyrics } from "@/lib/lyrics";
import { useSpotifySession } from "@/hooks/useSpotifySession";
import { usePlayer } from "@/providers/PlayerProvider";
import { Slider } from "@/components/ui/slider";

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return "--:--";
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

type MobileTab = "current" | "queue";

export function NowPlayingView() {
  const { state, actions } = usePlayer();
  const spotifySession = useSpotifySession();
  const [mobileTab, setMobileTab] = useState<MobileTab>("current");

  const currentTrack = state.currentTrack;
  const queue = state.queue;
  const currentTrackQueueItemId = currentTrack?.queueItemId ?? null;
  const progress = state.progressSeconds;
  const duration = state.durationSeconds;
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const [heroColor, setHeroColor] = useState("rgba(99, 102, 241, 0.25)");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!currentTrack?.thumbnailUrl) {
      queueMicrotask(() => {
        if (cancelled) return;
        setHeroColor("rgba(99, 102, 241, 0.25)");
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentTrack.thumbnailUrl;
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
      if (!count) return;
      setHeroColor(`rgba(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}, 0.3)`);
    };

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.thumbnailUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!currentTrack) {
      queueMicrotask(() => {
        if (cancelled) return;
        setLyrics(null);
        setLyricsLoading(false);
      });
      return;
    }

    if (!currentTrack.artist?.trim() || !currentTrack.title?.trim()) {
      queueMicrotask(() => {
        if (cancelled) return;
        setLyrics(null);
        setLyricsLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLyricsLoading(true);
    });
    fetchLyrics(currentTrack.artist, currentTrack.title)
      .then((text) => {
        if (cancelled) return;
        setLyrics(text);
      })
      .catch(() => {
        if (cancelled) return;
        setLyrics(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.artist, currentTrack?.title]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 md:hidden">
        <MobileTabButton tab="current" activeTab={mobileTab} onClick={setMobileTab} label="Actual" />
        <MobileTabButton tab="queue" activeTab={mobileTab} onClick={setMobileTab} label="Cola" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.35fr_1fr]">
        <div className={`${mobileTab === "current" ? "block" : "hidden"} md:block`}>
          <CurrentTrackPanel
            track={currentTrack}
            progress={isSeeking ? seekValue : progress}
            duration={duration}
            heroColor={heroColor}
            lyrics={lyrics}
            lyricsLoading={lyricsLoading}
            onSeekChange={(value) => {
              setIsSeeking(true);
              setSeekValue(value);
            }}
            onSeekCommit={(value) => {
              setIsSeeking(false);
              setSeekValue(value);
              actions.seek(value);
            }}
          />
        </div>

        <div className={`${mobileTab === "queue" ? "block" : "hidden"} md:block`}>
          <QueuePanel
            queue={queue}
            currentTrackQueueItemId={currentTrackQueueItemId}
            onPlay={(queueItemId) => {
              const selected = queue.find(
                (track) => (track.queueItemId ?? track.id) === queueItemId,
              );
              const isSpotifyTrack =
                selected?.source === "spotify" ||
                selected?.audioUrl?.startsWith("spotify:") === true;

              if (isSpotifyTrack && spotifySession.status !== "connected") {
                return;
              }

              void actions.playByQueueItemId(queueItemId).catch(() => {
                // Ignore playback failures to avoid uncaught promise noise.
              });
            }}
            onReorder={(newOrder) => actions.setQueue(newOrder)}
            onRemove={(queueItemId) => actions.removeTrack(queueItemId, "queueItemId")}
          />
        </div>
      </div>
    </div>
  );
}

function MobileTabButton({
  tab,
  activeTab,
  onClick,
  label,
}: {
  tab: MobileTab;
  activeTab: MobileTab;
  onClick: (tab: MobileTab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-colors ${
        activeTab === tab
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
      }`}
    >
      {label}
    </button>
  );
}

function CurrentTrackPanel({
  track,
  progress,
  duration,
  heroColor,
  lyrics,
  lyricsLoading,
  onSeekChange,
  onSeekCommit,
}: {
  track: ITrack | null;
  progress: number;
  duration: number;
  heroColor: string;
  lyrics: string | null;
  lyricsLoading: boolean;
  onSeekChange: (value: number) => void;
  onSeekCommit: (value: number) => void;
}) {
  if (!track) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="font-[family-name:var(--font-cormorant)] text-3xl">Reproduce algo para ver la información</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
      style={{
        background: `radial-gradient(circle at 20% 20%, ${heroColor} 0%, transparent 55%), var(--surface)`,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Track actual</p>
      <div className="mt-4 flex flex-col items-center">
        <div className="h-[220px] w-[220px] overflow-hidden rounded-2xl border border-[var(--line)] shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
          <img src={track.thumbnailUrl} alt={track.title} className="h-full w-full object-cover" />
        </div>
        <h2 className="mt-5 text-center font-[family-name:var(--font-cormorant)] text-4xl leading-tight">
          {track.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--foreground)]/90">{track.artist}</p>
        <p className="text-xs text-[var(--muted)]">{track.album ?? "Álbum no disponible"}</p>
      </div>

      <div className="mt-5">
        <Slider
          value={duration > 0 ? [progress] : [0]}
          max={duration || 0}
          step={1}
          disabled={duration <= 0}
          onValueChange={([val]) => onSeekChange(val)}
          onValueCommit={([val]) => onSeekCommit(val)}
          className="mb-2 w-full"
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
          <span>{formatDuration(progress)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Letras</p>
        {lyricsLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 size={14} className="animate-spin" />
            Cargando letras...
          </div>
        ) : (
          <p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line text-sm text-[var(--foreground)]/90">
            {lyrics ?? "Letras no disponibles para esta canción"}
          </p>
        )}
      </div>
    </div>
  );
}

function QueuePanel({
  queue,
  currentTrackQueueItemId,
  onPlay,
  onReorder,
  onRemove,
}: {
  queue: ITrack[];
  currentTrackQueueItemId: string | null;
  onPlay: (queueItemId: string) => void;
  onReorder: (tracks: ITrack[]) => void;
  onRemove: (queueItemId: string) => void;
}) {
  const [orderedQueue, setOrderedQueue] = useState<ITrack[]>(queue);
  useEffect(() => {
    setOrderedQueue(queue);
  }, [queue]);

  const ids = useMemo(
    () => orderedQueue.map((track) => track.queueItemId ?? track.id),
    [orderedQueue],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedQueue.findIndex(
      (track) => (track.queueItemId ?? track.id) === active.id,
    );
    const newIndex = orderedQueue.findIndex(
      (track) => (track.queueItemId ?? track.id) === over.id,
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedQueue, oldIndex, newIndex);
    setOrderedQueue(next);
    Promise.resolve().then(() => onReorder(next));
  };

  return (
    <div className="h-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Cola</p>
      {orderedQueue.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">La cola está vacía</p>
      ) : (
        <div className="mt-3 max-h-[72vh] overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {orderedQueue.map((track) => (
                  <QueueRow
                    key={track.queueItemId ?? track.id}
                    track={track}
                    isCurrent={(track.queueItemId ?? track.id) === currentTrackQueueItemId}
                    onPlay={onPlay}
                    onRemove={onRemove}
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

function QueueRow({
  track,
  isCurrent,
  onPlay,
  onRemove,
}: {
  track: ITrack;
  isCurrent: boolean;
  onPlay: (queueItemId: string) => void;
  onRemove: (queueItemId: string) => void;
}) {
  const queueItemId = track.queueItemId ?? track.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: queueItemId,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ${
        isCurrent ? "bg-[var(--accent)]/15" : "hover:bg-[var(--surface-elevated)]"
      } ${isDragging ? "opacity-75" : ""}`}
    >
      <button
        type="button"
        aria-label="Reordenar"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(event) => event.preventDefault()}
      >
        <GripVertical size={16} />
      </button>

      <button type="button" onClick={() => onPlay(queueItemId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <img src={track.thumbnailUrl} alt={track.title} className="h-10 w-10 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-semibold ${isCurrent ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
            {track.title}
          </p>
          <p className="truncate text-[11px] text-[var(--muted)]">{track.artist}</p>
        </div>
      </button>

      <button
        type="button"
        aria-label="Eliminar"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-500"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(queueItemId);
        }}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
