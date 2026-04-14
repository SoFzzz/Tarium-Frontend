import { NextResponse } from "next/server";
import { getClientCredentialsToken } from "@/lib/spotify-token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await getClientCredentialsToken();
    if (!token) {
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
