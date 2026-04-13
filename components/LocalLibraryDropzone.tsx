"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { parseFileToLocalTrack } from "@/lib/local-library/LocalTrackParserService";
import type { LocalTrack } from "@/lib/player/types";
import { useLocalLibrary } from "@/lib/local-library/LocalLibraryStore";

type Props = {
  onTracksParsed: (tracks: LocalTrack[]) => void;
};

const ACCEPTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/flac",
  "audio/wav",
  "audio/x-m4a",
  "audio/ogg",
];

const ACCEPT_PROP = {
  "audio/mpeg": [".mp3"],
  "audio/flac": [".flac"],
  "audio/wav": [".wav"],
  "audio/x-m4a": [".m4a"],
  "audio/ogg": [".ogg"],
};

export function LocalLibraryDropzone({ onTracksParsed }: Props) {
  const [isParsing, setIsParsing] = useState(false);
  const { addTracks } = useLocalLibrary();

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
          addTracks(parsed);
          onTracksParsed(parsed);
        }
      } finally {
        setIsParsing(false);
      }
    },
    [addTracks, onTracksParsed],
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
