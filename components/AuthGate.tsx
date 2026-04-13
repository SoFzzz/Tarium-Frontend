"use client";

import { ReactNode } from "react";
import { Button, Card } from "@heroui/react";

import { useAuth } from "@/providers/AuthProvider";

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
    <Card className="border border-white/10 bg-black/70 p-4 text-sm text-[var(--foreground)]">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Estás usando Tarium como invitado. Puedes seguir reproduciendo tu música
        local sin problema; si quieres sincronizar playlists, favoritos e historial
        entre dispositivos, inicia sesión.
      </p>
      <Button
        size="sm"
        className="mt-1 rounded-full bg-[var(--accent)] text-xs font-semibold text-black"
        onPress={() => {
          onRequireAuth?.();
          // Delega en flujo existente de Auth (p.ej. modal externo).
        }}
      >
        {ctaLabel ?? "Iniciar sesión para sincronizar"}
      </Button>
    </Card>
  );
}
