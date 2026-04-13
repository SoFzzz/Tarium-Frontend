import { NextResponse } from "next/server";

function getDeezerBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DEEZER_API_URL?.trim();

  if (!configured) {
    return "https://api.deezer.com";
  }

  if (configured.includes("api.deezer.com")) {
    return "https://api.deezer.com";
  }

  return configured.replace(/\/+$/, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json([]);
  }

  const deezerUrl = new URL("/search", getDeezerBaseUrl());
  deezerUrl.searchParams.set("q", query);
  deezerUrl.searchParams.set("limit", "10");
  deezerUrl.searchParams.set("output", "json");

  try {
    const response = await fetch(deezerUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar Deezer" },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { data?: unknown };
    const items = Array.isArray(data.data) ? data.data : [];

    return NextResponse.json(items);
  } catch {
    return NextResponse.json(
      { error: "Fallo al conectar con Deezer" },
      { status: 500 },
    );
  }
}
