import { type NextRequest, NextResponse } from "next/server";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

// GET /api/spotify/me/tracks — fetch user's saved tracks
export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken(request);
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const limit = request.nextUrl.searchParams.get("limit") || "50";
    const res = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}`, {
      headers: { Authorization: `Bearer ${result.token}` },
    });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const tracks = (data.items || []).map((item: any) => {
      const t = item.track;
      if (!t || !t.id) return null;
      return {
        id: t.id,
        title: t.name,
        artist: t.artists?.map((a: any) => a.name).join(", ") || "Artista desconocido",
        thumbnailUrl: t.album?.images?.[0]?.url || "/placeholder.png",
        durationInSeconds: Math.round((t.duration_ms || 0) / 1000),
        audioUrl: `spotify:track:${t.id}`,
        source: "spotify" as const,
        fromSpotify: true,
      };
    }).filter(Boolean);

    const response = NextResponse.json(tracks);
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    console.error("[me/tracks GET]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// PUT /api/spotify/me/tracks — save tracks to user's library
export async function PUT(request: NextRequest) {
  try {
    const result = await getValidToken(request);
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const body = await request.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No track ids provided" }, { status: 400 });
    }

    const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${ids.join(",")}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${result.token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);

    const response = NextResponse.json({ ok: true });
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    console.error("[me/tracks PUT]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// DELETE /api/spotify/me/tracks — remove tracks from user's library
export async function DELETE(request: NextRequest) {
  try {
    const result = await getValidToken(request);
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const body = await request.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No track ids provided" }, { status: 400 });
    }

    const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${ids.join(",")}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${result.token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);

    const response = NextResponse.json({ ok: true });
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch (err) {
    console.error("[me/tracks DELETE]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
