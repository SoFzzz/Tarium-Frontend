"use client";

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PlayerHistoryProvider({ children }: Props) {
  // BUGS.txt: este proyecto no tiene backend REST (/api/history/*).
  // El historial futuro se implementara directo en Supabase.
  return children;
}
