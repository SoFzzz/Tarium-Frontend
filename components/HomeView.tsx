"use client";

import { useEffect, useState } from "react";
import { SearchPanel } from "./SearchPanel";
import { type ITrack } from "@/lib/player/types";
import { type IArtist, type IAlbum } from "@/lib/spotify";
import { Play } from "lucide-react";
import { usePlayer } from "@/providers/PlayerProvider";

interface SpotifySessionProp {
  status: "loading" | "connected" | "disconnected" | "error";
}

export function HomeView({ session }: { session: SpotifySessionProp }) {
  const { actions } = usePlayer();
  const [topArtists, setTopArtists] = useState<IArtist[]>([]);
  const [recentAlbums, setRecentAlbums] = useState<IAlbum[]>([]);
  const [recommendations, setRecommendations] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.status !== "connected") return;
    
    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const [artistsRes, albumsRes] = await Promise.all([
          fetch("/api/spotify/top-artists").then(r => r.json()),
          fetch("/api/spotify/recently-played").then(r => r.json())
        ]);
        
        let artists: IArtist[] = [];
        if (!artistsRes.error) {
           artists = artistsRes;
           if (isMounted) setTopArtists(artists);
        }
        
        if (!albumsRes.error && isMounted) {
           setRecentAlbums(albumsRes);
        }

        if (artists.length > 0) {
          const seeds = artists.slice(0, 5).map(a => a.id).join(",");
          const recRes = await fetch(`/api/spotify/recommendations?seed_artists=${seeds}`).then(r => r.json());
          if (!recRes.error && isMounted) {
            setRecommendations(recRes);
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
    actions.addTrackNext(track);
    await actions.playById(track.id);
  };

  return (
    <div 
      className="flex flex-col gap-8 rounded-2xl border border-[var(--line)] p-4 sm:p-5 sm:min-h-[70vh]"
      style={{
        background: "linear-gradient(160deg, rgba(127, 114, 192, 0.08) 0%, var(--surface) 40%)"
      }}
    >
      <div className="mx-auto w-full max-w-3xl pt-6 pb-4">
        <h2 className="mb-4 text-center font-[family-name:var(--font-cormorant)] text-3xl sm:text-5xl font-semibold">
          ¿Qué quieres escuchar hoy?
        </h2>
        <SearchPanel 
          className="w-full mx-auto shadow-md rounded-full" 
          placeholder="Buscar artistas, canciones, álbumes..." 
        />
      </div>

      {session.status === "loading" && (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Cargando biblioteca...
        </div>
      )}

      {session.status === "disconnected" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[var(--muted)] max-w-md">
            Conecta tu cuenta de Spotify para descubrir artistas, escuchar tus canciones recientes y obtener recomendaciones personalizadas directas a tu reproductor.
          </p>
        </div>
      )}

      {session.status === "connected" && !loading && topArtists.length > 0 && (
        <div className="space-y-4">
           <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
             Artistas destacados
           </p>
           <div className="flex items-start gap-4 overflow-x-auto pb-4 hide-scrollbar">
             {topArtists.map(artist => (
               <div key={artist.id} className="flex min-w-[120px] flex-col items-center gap-2 text-center group cursor-pointer transition-transform hover:scale-105">
                 <div className="h-28 w-28 overflow-hidden rounded-full border border-[var(--line)] shadow-sm">
                   <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover" />
                 </div>
                 <p className="text-xs font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] line-clamp-2">{artist.name}</p>
               </div>
             ))}
           </div>
        </div>
      )}

      {session.status === "connected" && !loading && recentAlbums.length > 0 && (
        <div className="space-y-4">
           <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
             Álbumes recientes
           </p>
           <div className="flex items-start gap-4 overflow-x-auto pb-4 hide-scrollbar">
             {recentAlbums.map(album => (
               <div key={album.id} className="flex min-w-[140px] flex-col gap-2 group cursor-pointer transition-transform hover:scale-105">
                 <div className="h-32 w-32 overflow-hidden rounded-xl border border-[var(--line)] shadow-sm">
                   <img src={album.imageUrl} alt={album.name} className="h-full w-full object-cover" />
                 </div>
                 <div>
                   <p className="text-xs font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] truncate">{album.name}</p>
                   <p className="text-[10px] text-[var(--muted)] truncate">{album.artist}</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {session.status === "connected" && !loading && recommendations.length > 0 && (
        <div className="space-y-4">
           <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
             Recomendados para ti
           </p>
           <div className="flex flex-col gap-1 sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
             {recommendations.slice(0, 12).map(track => (
               <div 
                 key={track.id} 
                 className="group flex items-center justify-between rounded-xl border border-transparent p-2 hover:bg-[var(--surface-elevated)] hover:border-[var(--line)] transition-colors cursor-pointer"
                 onClick={() => handlePlayTrack(track)}
               >
                 <div className="flex items-center gap-3 overflow-hidden">
                   <img src={track.thumbnailUrl} alt={track.title} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                   <div className="min-w-0">
                     <p className="truncate text-xs font-semibold group-hover:text-[var(--accent)]">{track.title}</p>
                     <p className="truncate text-[10px] text-[var(--muted)]">{track.artist}</p>
                   </div>
                 </div>
                 <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white opacity-0 transition-opacity hover:scale-110 group-hover:opacity-100">
                   <Play size={14} className="ml-0.5" />
                 </button>
               </div>
             ))}
           </div>
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
