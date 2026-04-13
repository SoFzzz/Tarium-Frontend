"use client";

import { useMemo } from "react";

import { useAuth } from "@/providers/AuthProvider";
import type { PersistenceAdapter } from "./types";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { RemoteAdapter } from "./RemoteAdapter";

// Placeholder para futuro RemoteAdapter (authenticated).
// Por ahora solo devolvemos LocalStorageAdapter cuando no hay sesión,
// y dejamos el caso autenticado al backend actual.

export function usePersistenceAdapter(): PersistenceAdapter {
  const { session } = useAuth();

  const adapter = useMemo<PersistenceAdapter>(() => {
    // Guest mode: localStorage.
    if (!session || !session.access_token) {
      return new LocalStorageAdapter();
    }

    // Authenticated mode: Render + Supabase vía backend.
    return new RemoteAdapter(session.access_token);
  }, [session]);

  return adapter;
}
