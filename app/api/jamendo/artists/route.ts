import { NextRequest, NextResponse } from "next/server";

import { getTopArtists } from "@/lib/jamendo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.max(1, Math.min(100, Number(rawLimit))) : 10;

  const payload = await getTopArtists(Number.isFinite(limit) ? limit : 10);
  return NextResponse.json(payload, { status: 200 });
}
