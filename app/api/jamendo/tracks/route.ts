import { NextRequest, NextResponse } from "next/server";

import { getTopTracks } from "@/lib/jamendo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.max(1, Math.min(100, Number(rawLimit))) : 20;

  const payload = await getTopTracks(Number.isFinite(limit) ? limit : 20);
  return NextResponse.json(payload, { status: 200 });
}
