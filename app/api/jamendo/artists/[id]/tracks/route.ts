import { NextRequest, NextResponse } from "next/server";

import { getArtistTracks } from "@/lib/jamendo";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.max(1, Math.min(100, Number(rawLimit))) : 10;

  const payload = await getArtistTracks(id, Number.isFinite(limit) ? limit : 10);
  return NextResponse.json(payload, { status: 200 });
}
