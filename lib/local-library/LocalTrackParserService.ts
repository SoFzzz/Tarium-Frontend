"use client";

import { parseBlob } from "music-metadata-browser";

import type { LocalTrack, MetadataStatus } from "@/lib/player/types";

// Placeholder visual para cuando no hay carátula ni enriquecimiento todavía.
// Usamos /placeholder.png en public/ como recurso genérico.
const FALLBACK_ARTWORK_URL = "/placeholder.png";

function generateLocalTrackId(): string {
  const randomUUID = (globalThis.crypto as Crypto | undefined)?.randomUUID;
  if (typeof randomUUID === "function") {
    return `local-${randomUUID.call(globalThis.crypto)}`;
  }

  // Fallback defensivo si randomUUID no existe.
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
      // Normalizamos/casteamos el buffer que viene de music-metadata a un tipo
      // aceptado por Blob (BlobPart). En runtime sigue siendo un buffer de bytes.
      const data = picture.data as unknown as BlobPart;
      const blob = new Blob([data], { type: picture.format || "image/jpeg" });
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
  const id = generateLocalTrackId();
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
