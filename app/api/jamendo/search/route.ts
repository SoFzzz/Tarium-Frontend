import { NextRequest, NextResponse } from "next/server";

import { searchTracks } from "@/lib/jamendo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.max(1, Math.min(100, Number(rawLimit))) : 20;

  if (!q) {
    return NextResponse.json({ results: [], error: "missing_q" }, { status: 400 });
  }

  const payload = await searchTracks(q, Number.isFinite(limit) ? limit : 20);
  return NextResponse.json(payload, { status: 200 });
}
