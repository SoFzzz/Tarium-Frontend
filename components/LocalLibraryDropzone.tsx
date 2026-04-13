"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { parseFileToLocalTrack } from "@/lib/local-library/LocalTrackParserService";
import type { LocalTrack } from "@/lib/player/types";

type Props = {
  onTracksParsed: (tracks: LocalTrack[]) => void;
};

const ACCEPTED_MIME_TYPES = [
  "audio/mpeg", // mp3
  "audio/mp3", // algunos navegadores
  "audio/flac",
  "audio/x-flac",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/x-pn-wav",
  "audio/mp4", // m4a
  "audio/aac",
  "audio/ogg",
  "audio/vorbis",
];

const ACCEPT_PROP = {
  "audio/*": ACCEPTED_MIME_TYPES,
};

export function LocalLibraryDropzone({ onTracksParsed }: Props) {
  const [isParsing, setIsParsing] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsParsing(true);

      try {
        const parsed: LocalTrack[] = [];

        for (const file of files) {
          if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
            // El navegador aún podría reproducir por extensión, pero
            // aquí filtramos por tipos conocidos.
            continue;
          }

          const track = await parseFileToLocalTrack(file);
          parsed.push(track);
        }

        if (parsed.length > 0) {
          onTracksParsed(parsed);
        }
      } finally {
        setIsParsing(false);
      }
    },
    [onTracksParsed],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      void handleFiles(acceptedFiles);
    },
    [handleFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: ACCEPT_PROP,
  });

  return (
    <div
      {...getRootProps()}
      className="rounded-lg border border-dashed border-gray-500 px-4 py-6 text-center text-sm text-gray-300"
    >
      <input {...getInputProps()} />
      <p className="font-medium">
        {isDragActive
          ? "Suelta tus archivos de audio aquí"
          : "Arrastra y suelta tus archivos de audio, o haz clic para seleccionar"}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Formatos soportados: MP3, FLAC, WAV, M4A, OGG
      </p>
      {isParsing ? (
        <p className="mt-2 text-xs text-gray-400">Analizando metadatos…</p>
      ) : null}
    </div>
  );
}
