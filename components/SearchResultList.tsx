"use client";

import { Button, Card } from "@heroui/react";
import { Heart, ListPlus, PlusCircle } from "lucide-react";

import { usePlayer } from "@/providers/PlayerProvider";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import type { YouTubeSearchResult } from "@/lib/player/types";
import { AuthGate } from "./AuthGate";

type Props = {
  results: YouTubeSearchResult[];
};

export function SearchResultList({ results }: Props) {
  const { actions } = usePlayer();
  const { playlists, addTrackToPlaylist } = usePlaylists();
  const { addFavorite } = useFavorites();

  if (!results.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {results.map((item) => (
        <Card
          key={item.youtubeId}
          className="flex items-center justify-between gap-3 border border-white/8 bg-black/40 px-3 py-2 text-xs"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white/90">{item.title}</p>
              <p className="truncate text-[11px] text-white/60">
                {item.artistOrChannel}
                {item.durationSeconds
                  ? ` • ${Math.floor(item.durationSeconds / 60)}:${(item.durationSeconds % 60)
                      .toString()
                      .padStart(2, "0")}`
                  : null}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            {/* Agregar a cola como track local virtual (solo metadatos) */}
            <Button
              isIconOnly
              size="sm"
              className="h-7 w-7 border border-white/10 bg-white/5 text-white/80"
              onPress={() => {
                const track = {
                  id: `yt-${item.youtubeId}`,
                  title: item.title,
                  artist: item.artistOrChannel,
                  thumbnailUrl: item.thumbnailUrl,
                };
                actions.addTrack(track);
              }}
            >
              <PlusCircle size={14} />
            </Button>

            {/* Acciones de persistencia protegidas por AuthGate */}
            <AuthGate ctaLabel="Iniciar sesión para guardar" onRequireAuth={() => {}}>
              <Button
                isIconOnly
                size="sm"
                className="h-7 w-7 border border-white/10 bg-white/5 text-white/80"
                onPress={async () => {
                  if (!playlists.length) return;
                  const target = playlists[0]!;
                  await addTrackToPlaylist(target.id, {
                    track_id: `yt-${item.youtubeId}`,
                    title: item.title,
                    artist: item.artistOrChannel,
                    thumbnail_url: item.thumbnailUrl,
                    duration_seconds: item.durationSeconds,
                  });
                }}
              >
                <ListPlus size={14} />
              </Button>

              <Button
                isIconOnly
                size="sm"
                className="h-7 w-7 border border-white/10 bg-white/5 text-white/80"
                onPress={async () => {
                  await addFavorite({
                    track_id: `yt-${item.youtubeId}`,
                    title: item.title,
                    artist: item.artistOrChannel,
                    thumbnail_url: item.thumbnailUrl,
                  });
                }}
              >
                <Heart size={14} />
              </Button>
            </AuthGate>
          </div>
        </Card>
      ))}
    </div>
  );
}
