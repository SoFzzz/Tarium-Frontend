"use client";

import { Heart } from "lucide-react";

import type { Favorite } from "@/hooks/useFavorites";

type Props = {
  favorites: Favorite[];
  onPlayFavorite: (fav: Favorite) => void;
  onRemoveFavorite: (fav: Favorite) => void | Promise<void>;
};

export function FavoritesView({ favorites, onPlayFavorite, onRemoveFavorite }: Props) {
  if (!favorites.length) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
        Aún no has marcado ninguna canción como favorita.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
        Favoritos ({favorites.length})
      </p>
      <div className="max-h-80 overflow-y-auto pr-1">
        <ul className="space-y-1 text-xs">
          {favorites.map((fav) => (
            <li key={fav.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--surface-elevated)]">
              <button
                type="button"
                className="flex flex-1 items-center gap-3 text-left"
                onClick={() => onPlayFavorite(fav)}
              >
                <img
                  src={fav.thumbnail_url}
                  alt={fav.title}
                  className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{fav.title}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">{fav.artist}</p>
                </div>
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                onClick={() => onRemoveFavorite(fav)}
              >
                <Heart size={13} fill="currentColor" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
