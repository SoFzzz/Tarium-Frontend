import { NextResponse } from "next/server";
import { getValidToken, getClientCredentialsToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: albumId } = await params;
    const result = await getValidToken();
    const token = result?.token ?? await getClientCredentialsToken();

    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    // Get album details for artist info + images
    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!albumRes.ok) throw new Error(`Spotify ${albumRes.status}`);
    const album = await albumRes.json();

    const albumImage = album.images?.[0]?.url || "/placeholder.png";
    const albumArtist = album.artists?.map((a: any) => a.name).join(", ") || "Artista desconocido";

    // Get tracks
    const tracksRes = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!tracksRes.ok) throw new Error(`Spotify ${tracksRes.status}`);
    const tracksData = await tracksRes.json();

    const tracks = (tracksData.items || []).map((t: any) => ({
      id: t.id,
      title: t.name,
      artist: t.artists?.map((a: any) => a.name).join(", ") || albumArtist,
      thumbnailUrl: albumImage,
      durationInSeconds: Math.round((t.duration_ms || 0) / 1000),
      audioUrl: `spotify:track:${t.id}`,
      source: "spotify",
    }));

    const response = NextResponse.json(tracks);
    applyRefreshedCookies(response, result?.refreshed ?? null);
    return response;
  } catch (err) {
    console.error("[album tracks]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
