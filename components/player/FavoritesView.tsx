"use client";

import { Heart } from "lucide-react";

import type { Favorite } from "@/hooks/useFavorites";

type Props = {
  favorites: Favorite[];
  authenticated?: boolean;
  spotifyFavIds?: Set<string>;
  onPlayFavorite: (fav: Favorite) => void;
  onRemoveFavorite: (fav: Favorite) => void | Promise<void>;
};

export function FavoritesView({ favorites, authenticated, spotifyFavIds, onPlayFavorite, onRemoveFavorite }: Props) {
  if (!authenticated) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
        <p className="text-center">Inicia sesión para guardar tus playlists y favoritos</p>
      </div>
    );
  }

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
      <div className="max-h-[60vh] overflow-y-auto pr-1 sm:max-h-80">
        <ul className="space-y-1 text-xs">
          {favorites.map((fav) => {
            const isSpotify = spotifyFavIds?.has(fav.track_id);
            return (
              <li key={fav.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--surface-elevated)]">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => onPlayFavorite(fav)}
                >
                  <div className="relative">
                    <img
                      src={fav.thumbnail_url}
                      alt={fav.title}
                      className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                    />
                    {isSpotify && (
                      <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1DB954] text-white" title="Sincronizado con Spotify">
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{fav.title}</p>
                    <p className="truncate text-[11px] text-[var(--muted)]">{fav.artist}</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white sm:h-7 sm:w-7"
                  onClick={() => onRemoveFavorite(fav)}
                >
                  <Heart size={13} fill="currentColor" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
