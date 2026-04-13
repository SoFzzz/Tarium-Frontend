"use client";

import { ReactNode } from "react";

import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

type AuthGateProps = {
  children: ReactNode;
  ctaLabel?: string;
  onRequireAuth?: () => void;
};

/**
 * Envuelve acciones de persistencia sensibles (playlists, favoritos, historial)
 * sin bloquear nunca la reproducción local. Si no hay sesión, muestra un CTA
 * de login y permite seguir usando la app en modo invitado.
 */
export function AuthGate({ children, ctaLabel, onRequireAuth }: AuthGateProps) {
  const { user, signIn } = useAuth();

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--foreground)]">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Estás usando Tarium como invitado. Puedes seguir reproduciendo tu música
        local sin problema; si quieres sincronizar playlists, favoritos e historial
        entre dispositivos, inicia sesión.
      </p>
      <Button
        size="sm"
        className="mt-1 text-xs font-semibold"
        onClick={() => {
          onRequireAuth?.();
          // Delega en flujo existente de Auth (p.ej. modal externo).
        }}
      >
        {ctaLabel ?? "Iniciar sesión para sincronizar"}
      </Button>
    </div>
  );
}
