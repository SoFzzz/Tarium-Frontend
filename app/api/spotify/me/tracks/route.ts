import { type NextRequest, NextResponse } from "next/server";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

type SpotifySavedTrackItem = {
  track?: {
    id?: unknown;
    name?: unknown;
    duration_ms?: unknown;
    artists?: unknown;
    album?: unknown;
  };
};

export async function GET(request: NextRequest) {
  try {
    const result = await getValidToken();
    if (!result) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const limit = request.nextUrl.searchParams.get("limit") || "50";
    const res = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}`, {
      headers: { Authorization: `Bearer ${result.token}` },
    });
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json();

    const items = Array.isArray(data.items) ? (data.items as SpotifySavedTrackItem[]) : [];
    const tracks = items.map((item) => {
      const t = item.track;
      if (!t || !t.id) return null;

      const artists = Array.isArray(t.artists) ? (t.artists as unknown[]) : [];
      const artist = artists
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const name = (a as { name?: unknown }).name;
          return typeof name === "string" ? name : null;
        })
        .filter((name): name is string => Boolean(name))
        .join(", ");

      const albumObj = t.album && typeof t.album === "object" ? (t.album as Record<string, unknown>) : null;
      const images = albumObj && Array.isArray(albumObj.images) ? (albumObj.images as unknown[]) : [];
      const firstImage = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>) : null;
      const thumbnailUrl = (firstImage && typeof firstImage.url === "string" ? firstImage.url : "") || "/placeholder.png";

      return {
        id: String(t.id),
        title: typeof t.name === "string" ? t.name : String(t.name ?? ""),
        artist: artist || "Artista desconocido",
        thumbnailUrl,
        durationInSeconds: typeof t.duration_ms === "number" ? Math.round(t.duration_ms / 1000) : 0,
        audioUrl: `spotify:track:${String(t.id)}`,
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

export async function PUT(request: NextRequest) {
  try {
    const result = await getValidToken();
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

export async function DELETE(request: NextRequest) {
  try {
    const result = await getValidToken();
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
