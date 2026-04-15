"use client";

import { useEffect, useState } from "react";
import { type ITrack } from "@/lib/player/types";
import { Play } from "lucide-react";
import { usePlayer } from "@/providers/PlayerProvider";

interface SpotifySessionProp {
  status: "loading" | "connected" | "disconnected" | "error";
}

export function HomeView({
  session,
}: {
  session: SpotifySessionProp;
}) {
  const { actions } = usePlayer();
  const [recommendations, setRecommendations] = useState<ITrack[]>([]);
  const [jamendoTopTracks, setJamendoTopTracks] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.status === "loading") return;

    let isMounted = true;
    setLoading(true);

    const wait = (ms: number) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });

    async function loadData() {
      try {
        if (session.status === "connected") {
          let recItems: ITrack[] = [];

          for (let attempt = 0; attempt < 3; attempt += 1) {
            const recRes = await fetch("/api/spotify/recommendations", { cache: "no-store" }).then((r) => r.json());
            const parsed = Array.isArray(recRes) ? recRes : (recRes?.tracks?.items ?? []);
            recItems = Array.isArray(parsed) ? (parsed as ITrack[]) : [];

            if (!recRes?.error && recItems.length > 0) {
              break;
            }

            if (attempt < 2) {
              await wait(350 + attempt * 450);
            }
          }

          if (isMounted) {
            setRecommendations(recItems);
          }

          if (isMounted) {
            setJamendoTopTracks([]);
          }
          return;
        }

        if (session.status === "disconnected") {
          const tracksRes = await fetch("/api/jamendo/tracks?limit=20", { cache: "no-store" }).then((r) => r.json());
          const tracks = Array.isArray(tracksRes?.results) ? (tracksRes.results as ITrack[]) : [];

          if (isMounted) {
            setJamendoTopTracks(tracks);

            setRecommendations([]);
          }
        }
      } catch (err) {
        console.error("Error loading home view data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => { isMounted = false; };
  }, [session.status]);

  const handlePlayTrack = async (track: ITrack) => {
    // Home clicks should always start playback.
    actions.loadQueue([track]);
    await actions.playById(track.id);
  };

  const showJamendo = session.status === "disconnected";

  return (
    <div 
      className="flex flex-col gap-8 rounded-2xl border border-[var(--line)] p-4 sm:p-5 sm:min-h-[70vh]"
      style={{
        background: "linear-gradient(160deg, rgba(var(--brand-accent-rgb), 0.08) 0%, var(--surface) 40%)"
      }}
    >
      <div className="mx-auto w-full max-w-3xl pt-6 pb-4">
        <h2 className="mb-4 text-center font-[family-name:var(--font-cormorant)] text-3xl sm:text-5xl font-semibold">
          ¿Qué quieres escuchar hoy?
        </h2>
      </div>

      {session.status === "loading" && (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Cargando biblioteca...
        </div>
      )}

      {showJamendo && loading && (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Cargando música libre…
        </div>
      )}

      {session.status === "connected" && !loading && recommendations.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
              Recomendados para ti
            </p>
          </div>
           <div className="flex flex-col gap-1 sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {recommendations.slice(0, 12).map(track => (
                 <div 
                   key={track.id} 
                   className="group flex items-center justify-between rounded-xl border border-transparent px-3 py-2 hover:bg-[var(--surface-elevated)] hover:border-[var(--line)] transition-colors cursor-pointer"
                   onClick={() => handlePlayTrack(track)}
                 >
                  <div className="flex items-center gap-3 overflow-hidden">
                   <img src={track.thumbnailUrl} alt={track.title} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0">
                     <p className="truncate text-sm font-semibold leading-snug group-hover:text-[var(--accent)]">{track.title}</p>
                     <p className="truncate text-xs text-[var(--muted)]">{track.artist}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handlePlayTrack(track);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white opacity-0 transition-opacity hover:scale-110 group-hover:opacity-100"
                  >
                    <Play size={14} className="ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
         </div>
      )}

      {session.status === "connected" && !loading && recommendations.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[var(--muted)] max-w-md">
            No se pudieron cargar recomendaciones de Spotify en este momento.
          </p>
        </div>
      )}

      {showJamendo && !loading && jamendoTopTracks.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
              Recomendados para ti
            </p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">vía Jamendo · música libre</p>
          </div>
           <div className="flex flex-col gap-1 sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
             {jamendoTopTracks.slice(0, 12).map((track) => (
               <div
                 key={track.id}
                 className="group flex items-center justify-between rounded-xl border border-transparent px-3 py-2 hover:bg-[var(--surface-elevated)] hover:border-[var(--line)] transition-colors cursor-pointer"
                 onClick={() => handlePlayTrack(track)}
               >
                 <div className="flex items-center gap-3 overflow-hidden">
                   <img
                     src={track.thumbnailUrl}
                     alt={track.title}
                     className="h-12 w-12 shrink-0 rounded-md object-cover"
                   />
                   <div className="min-w-0">
                     <p className="truncate text-sm font-semibold leading-snug group-hover:text-[var(--accent)]">
                       {track.title}
                     </p>
                     <p className="truncate text-xs text-[var(--muted)]">{track.artist}</p>
                   </div>
                 </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handlePlayTrack(track);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white opacity-0 transition-opacity hover:scale-110 group-hover:opacity-100"
                >
                  <Play size={14} className="ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showJamendo && !loading && jamendoTopTracks.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[var(--muted)] max-w-md">
            No se pudo cargar contenido de Jamendo en este momento.
          </p>
        </div>
      )}

      {/* Utilities */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
