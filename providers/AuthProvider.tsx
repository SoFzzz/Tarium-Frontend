'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  loading: boolean;
  session: Session | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CLEAR_QUEUE_EVENT = "tarium:clear-queue";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Solo para bootstrap: evitar flash de user=null con sesion existente.
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const loading = authLoading || actionLoading;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const isTransientCallbackPath = (pathname: string) =>
      pathname === "/callback" || pathname === "/api/spotify/callback";

    const sanitizeHistoryEntry = () => {
      const { pathname, search, hash } = window.location;
      if (!isTransientCallbackPath(pathname)) return;

      const safeUrl = `/${search || ""}${hash || ""}`;
      window.history.replaceState(null, "", safeUrl);
    };

    sanitizeHistoryEntry();

    const handlePopState = () => {
      sanitizeHistoryEntry();
    };

    window.addEventListener("popstate", handlePopState);

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;
        if (error) throw error;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (err) {
        if (!alive) return;
        console.error('Error getting session:', err);
        setError('Error al obtener sesión');
        setSession(null);
        setUser(null);
      } finally {
        if (!alive) return;
        setAuthLoading(false);
      }
    };

    void init();

    // Suscribirse a cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
      setActionLoading(false);

      if (event === "SIGNED_OUT") {
        window.dispatchEvent(new Event(CLEAR_QUEUE_EVENT));
      }
    });

    return () => {
      alive = false;
      subscription?.unsubscribe();
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrarse';
      setError(message);
      console.error('Sign up error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      console.error('Sign in error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const signOut = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cerrar sesión';
      setError(message);
      console.error('Sign out error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        loading,
        session,
        signUp,
        signIn,
        signOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
