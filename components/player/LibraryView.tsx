"use client";

import { Heart } from "lucide-react";

import type { ITrack } from "@/lib/player/types";

type Props = {
  queue: ITrack[];
  currentTrackId: string | null;
  onPlayTrack: (id: string) => void;
  onToggleFavorite: (track: ITrack | null) => void | Promise<void>;
};

export function LibraryView({ queue, currentTrackId, onPlayTrack, onToggleFavorite }: Props) {
  if (!queue.length) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
        Todavía no has cargado archivos. Usa la vista Inicio para añadir tu biblioteca local.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
          Biblioteca local ({queue.length})
        </p>
      </div>
      <div className="max-h-80 overflow-y-auto pr-1">
        <ul className="space-y-1 text-xs">
          {queue.map((track) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <li key={track.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--surface-elevated)]">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => onPlayTrack(track.id)}
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
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={() => onToggleFavorite(track)}
                >
                  <Heart size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
