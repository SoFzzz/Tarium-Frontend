"use client";

import { useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type Mode = "login" | "register";

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Email o contrasena incorrectos";
  }

  if (message.includes("User already registered")) {
    return "Este email ya esta registrado";
  }

  return message;
}

export function AuthModal() {
  // Backwards compatible: if a parent doesn't control visibility,
  // render the modal by default.
  return <AuthModalControlled />;
}

type AuthModalProps = {
  open?: boolean;
  onClose?: () => void;
};

export function AuthModalControlled({ open = true, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordCount = password.length;
  const passwordCountClass = useMemo(() => {
    if (passwordCount >= 20) return "text-red-500";
    return "text-[var(--muted)]";
  }, [passwordCount]);

  const validatePassword = () => {
    if (password.length < 8) {
      setError("Minimo 8 caracteres");
      return false;
    }

    if (password.length > 20) {
      setError("Maximo 20 caracteres");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validatePassword()) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Ingresa tu email");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;

      // Registro exitoso: iniciar sesion automaticamente (si no quedo ya logueado).
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de autenticacion";
      setError(mapAuthError(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Cuenta
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl">
              Inicia sesion para continuar
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] text-sm text-[var(--muted)]"
            onClick={() => onClose?.()}
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] p-1 text-xs">
          <button
            type="button"
            className={`flex-1 rounded-full px-3 py-2 font-semibold transition-colors ${
              mode === "login" ? "bg-[var(--accent)] text-white" : "text-[var(--foreground)]"
            }`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full px-3 py-2 font-semibold transition-colors ${
              mode === "register" ? "bg-[var(--accent)] text-white" : "text-[var(--foreground)]"
            }`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--muted)]">Email</label>
            <input
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--muted)]">Contrasena</label>
            <input
              type="password"
              minLength={8}
              maxLength={20}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="********"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <p className={`text-[11px] ${passwordCountClass}`}>{passwordCount}/20</p>
          </div>

          {error ? <p className="text-xs text-red-500">{error}</p> : null}

          <Button
            className="w-full"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Procesando..." : mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
          </Button>

          <p className="text-xs text-[var(--muted)]">
            {mode === "login"
              ? "No tienes cuenta? Crea una en la pestaña Register."
              : "Al crear tu cuenta se iniciara sesion automaticamente."}
          </p>
        </div>
      </div>
    </div>
  );
}
