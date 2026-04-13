"use client";

import { useMemo } from "react";

import { useAuth } from "@/providers/AuthProvider";
import type { PersistenceAdapter } from "./types";
import { LocalStorageAdapter } from "./LocalStorageAdapter";

// Nota: este proyecto no incluye backend REST.
// La persistencia autenticada se implementa directo con Supabase desde hooks.

export function usePersistenceAdapter(): PersistenceAdapter {
  const { session } = useAuth();

  const adapter = useMemo<PersistenceAdapter>(() => {
    // Guest mode: localStorage.
    if (!session || !session.access_token) {
      return new LocalStorageAdapter();
    }

    // BUGS.txt: No hay backend REST en este proyecto.
    // Para evitar intentos de fetch a /api/*, usamos el mismo adapter local.
    return new LocalStorageAdapter();
  }, [session]);

  return adapter;
}
