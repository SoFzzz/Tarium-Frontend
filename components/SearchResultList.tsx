"use client";

import { Heart, ListPlus, PlusCircle } from "lucide-react";

import { usePlayer } from "@/providers/PlayerProvider";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import type { ITrack } from "@/lib/player/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  results: ITrack[];
};

export function SearchResultList({ results }: Props) {
  const { actions } = usePlayer();
  const { user } = useAuth();
  const { playlists, addTrackToPlaylist } = usePlaylists();
  const { addFavorite } = useFavorites();

  if (!results.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {results.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-xs"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{item.title}</p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {item.artist}
                {item.durationInSeconds
                  ? (() => {
                      const s = Math.floor(item.durationInSeconds);
                      const m = Math.floor(s / 60);
                      return ` • ${m}:${String(s % 60).padStart(2, "0")}`;
                    })()
                  : null}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 rounded-full px-0"
              onClick={() => {
                actions.addTrack(item);
              }}
              >
                <PlusCircle size={14} />
              </Button>

              {/* Persistencia: requiere sesion */}
              {user ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 rounded-full px-0"
                    onClick={async () => {
                      if (!playlists.length) return;
                      const target = playlists[0]!;
                      await addTrackToPlaylist(target.id, {
                        track_id: item.id,
                        title: item.title,
                        artist: item.artist,
                        thumbnail_url: item.thumbnailUrl,
                        duration_seconds: item.durationInSeconds,
                      });
                    }}
                  >
                    <ListPlus size={14} />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 rounded-full px-0"
                    onClick={async () => {
                      await addFavorite({
                        track_id: item.id,
                        title: item.title,
                        artist: item.artist,
                        thumbnail_url: item.thumbnailUrl,
                      });
                    }}
                  >
                    <Heart size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="h-7 w-7 rounded-full px-0 opacity-40 cursor-not-allowed"
                        >
                          <ListPlus size={14} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Inicia sesión para guardar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="h-7 w-7 rounded-full px-0 opacity-40 cursor-not-allowed"
                        >
                          <Heart size={14} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Inicia sesión para guardar</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
