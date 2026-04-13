"use client";

import { parseBlob } from "music-metadata-browser";

import type { LocalTrack, MetadataStatus } from "@/lib/player/types";

// Placeholder visual para cuando no hay carátula ni enriquecimiento todavía.
const FALLBACK_ARTWORK_URL = "/images/track-placeholder.png";

// Genera un id estable a partir de nombre + tamaño + duracion en segundos.
function stableTrackId(fileName: string, size: number, durationSeconds: number): string {
  const base = `${fileName}::${size}::${durationSeconds}`;
  let hash = 0;

  for (let i = 0; i < base.length; i += 1) {
    const chr = base.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }

  return `local-${Math.abs(hash)}`;
}

function inferMetadataStatus(title: string, artist: string, album: string): MetadataStatus {
  const hasTitle = title.trim().length > 0;
  const hasArtist = artist.trim().length > 0;
  const hasAlbum = album.trim().length > 0;

  if (hasTitle && hasArtist) {
    return "native";
  }

  if (hasTitle || hasArtist || hasAlbum) {
    return "enriched"; // parcialmente presente, aunque todavía no viene de YouTube
  }

  return "missing";
}

export async function parseFileToLocalTrack(file: File): Promise<LocalTrack> {
  const objectUrl = URL.createObjectURL(file);

  let title = "";
  let artist = "";
  let album = "";
  let durationSeconds = 0;
  let artworkUrl: string | null = null;

  try {
    const metadata = await parseBlob(file);

    title = metadata.common.title ?? "";
    artist = metadata.common.artist ?? "";
    album = metadata.common.album ?? "";

    if (typeof metadata.format.duration === "number") {
      durationSeconds = Math.round(metadata.format.duration);
    }

    const picture = metadata.common.picture?.[0];

    if (picture && picture.data && picture.data.length > 0) {
      const blob = new Blob([picture.data], { type: picture.format || "image/jpeg" });
      artworkUrl = URL.createObjectURL(blob);
    }
  } catch {
    // Si el parse falla, seguimos con valores vacios y duration 0.
  }

  if (!title) {
    title = file.name;
  }

  if (!artworkUrl) {
    artworkUrl = FALLBACK_ARTWORK_URL;
  }

  const effectiveDuration = durationSeconds > 0 ? durationSeconds : 0;
  const id = stableTrackId(file.name, file.size, effectiveDuration);
  const metadataStatus = inferMetadataStatus(title, artist, album);

  const localTrack: LocalTrack = {
    id,
    fileName: file.name,
    file,
    objectUrl,
    title,
    artist,
    album,
    durationSeconds: effectiveDuration,
    artworkUrl,
    sourceType: "local",
    metadataStatus,
  };

  return localTrack;
}
