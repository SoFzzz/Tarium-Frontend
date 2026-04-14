"use client";

import { useEffect, useState } from "react";
import { type ITrack } from "@/lib/player/types";
import { type IAlbum } from "@/lib/spotify";
import { usePlayer } from "@/providers/PlayerProvider";
import { Play, Loader2 } from "lucide-react";

export function AlbumsView({ spotifyConnected }: { spotifyConnected?: boolean }) {
  const { actions } = usePlayer();
  const [albums, setAlbums] = useState<IAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Use new-releases (works with client credentials even without login)
    fetch("/api/spotify/new-releases")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error && Array.isArray(data)) {
          setAlbums(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePlayAlbum = async (album: IAlbum) => {
    setLoadingAlbumId(album.id);
    try {
      const res = await fetch(`/api/spotify/albums/${album.id}/tracks`);
      const tracks: ITrack[] = await res.json();
      if (tracks.length > 0) {
        actions.loadQueue(tracks);
        await actions.playById(tracks[0]!.id);
      }
    } catch (err) {
      console.error("Error loading album tracks", err);
    } finally {
      setLoadingAlbumId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
        Nuevos lanzamientos
      </p>
      {loading ? (
        <div className="mt-8 text-center text-sm text-[var(--muted)]">Cargando álbumes…</div>
      ) : albums.length === 0 ? (
        <div className="mt-8 text-center text-sm text-[var(--muted)]">
          No se encontraron álbumes.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {albums.map((album) => (
            <button
              key={album.id}
              type="button"
              className="group flex flex-col gap-2 rounded-xl p-2 text-left transition-colors hover:bg-[var(--surface-elevated)]"
              onClick={() => void handlePlayAlbum(album)}
              disabled={loadingAlbumId === album.id}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--line)] shadow-sm transition-transform group-hover:scale-[1.03]">
                <img src={album.imageUrl} alt={album.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  {loadingAlbumId === album.id ? (
                    <Loader2 size={28} className="animate-spin text-white" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-lg">
                      <Play size={18} className="ml-0.5" />
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 px-0.5">
                <p className="truncate text-xs font-semibold group-hover:text-[var(--accent)]">{album.name}</p>
                <p className="truncate text-[10px] text-[var(--muted)]">{album.artist}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
