import { NextResponse } from "next/server";
import { getValidToken, applyRefreshedCookies } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getValidToken();
    if (!result) {
      return NextResponse.json(null, { status: 200 });
    }

    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${result.token}`, Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(null, { status: 200 });
    }

    const data = (await res.json()) as {
      display_name?: string;
      images?: { url: string }[];
      id?: string;
      email?: string;
    };

    const response = NextResponse.json({
      displayName: data.display_name ?? null,
      avatarUrl: data.images?.[0]?.url ?? null,
      id: data.id ?? null,
      email: data.email ?? null,
    });
    applyRefreshedCookies(response, result.refreshed);
    return response;
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
