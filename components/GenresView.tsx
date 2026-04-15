"use client";

import { useState } from "react";
import { type ITrack } from "@/lib/player/types";
import { usePlayer } from "@/providers/PlayerProvider";
import { Loader2 } from "lucide-react";

// Hardcoded popular genres (Spotify browse/categories API was deprecated in 2024)
const GENRES = [
  { id: "pop", name: "Pop", color: "from-pink-500/80 to-rose-600/80" },
  { id: "rock", name: "Rock", color: "from-red-500/80 to-orange-600/80" },
  { id: "hip-hop", name: "Hip-Hop", color: "from-amber-500/80 to-yellow-600/80" },
  { id: "electronic", name: "Electronic", color: "from-cyan-500/80 to-blue-600/80" },
  { id: "jazz", name: "Jazz", color: "from-violet-500/80 to-purple-600/80" },
  { id: "classical", name: "Classical", color: "from-emerald-500/80 to-teal-600/80" },
  { id: "reggaeton", name: "Reggaeton", color: "from-orange-500/80 to-red-600/80" },
  { id: "r-n-b", name: "R&B", color: "from-fuchsia-500/80 to-pink-600/80" },
  { id: "metal", name: "Metal", color: "from-gray-600/80 to-gray-800/80" },
  { id: "indie", name: "Indie", color: "from-lime-500/80 to-emerald-600/80" },
  { id: "latin", name: "Latin", color: "from-rose-500/80 to-pink-600/80" },
  { id: "k-pop", name: "K-Pop", color: "from-sky-500/80 to-indigo-600/80" },
  { id: "city-pop", name: "City Pop", color: "from-purple-500/80 to-violet-600/80" },
  { id: "lo-fi", name: "Lo-fi", color: "from-teal-500/80 to-cyan-600/80" },
];

export function GenresView({ spotifyConnected }: { spotifyConnected?: boolean }) {
  const { actions } = usePlayer();
  const [loadingGenreId, setLoadingGenreId] = useState<string | null>(null);

  const shuffleTracks = (tracks: ITrack[]): ITrack[] => {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleGenreClick = async (genre: (typeof GENRES)[number]) => {
    if (!spotifyConnected) return;

    setLoadingGenreId(genre.id);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(genre.name)}`);
      if (!res.ok) {
        throw new Error(`Spotify ${res.status}`);
      }
      const tracks = (await res.json()) as ITrack[];
      if (tracks.length > 0) {
        const shuffled = shuffleTracks(tracks);
        actions.loadQueue(shuffled);
        try {
          await actions.play();
        } catch {
          // Ignore playback failures to avoid uncaught promise noise.
        }
      }
    } catch (err) {
      console.error("Error loading genre tracks", err);
    } finally {
      setLoadingGenreId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
        Explorar géneros
      </p>
      {!spotifyConnected ? (
        <div className="mt-8 text-center text-sm text-[var(--muted)]">
          Conecta Spotify para explorar géneros musicales.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              type="button"
              className={`group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl bg-gradient-to-br ${genre.color} p-3 text-left shadow-sm transition-transform hover:scale-[1.03] disabled:opacity-60`}
              onClick={() => void handleGenreClick(genre)}
              disabled={Boolean(loadingGenreId)}
            >
              <span className="relative z-10 text-sm font-bold text-white drop-shadow-md">
                {genre.name}
              </span>
              {loadingGenreId === genre.id ? (
                <span className="absolute right-2 top-2">
                  <Loader2 size={14} className="animate-spin text-white" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
