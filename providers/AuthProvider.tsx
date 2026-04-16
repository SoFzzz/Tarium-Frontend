'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { sanitizeSpotifyUrlState } from '@/lib/auth/spotify-url-state';
import { TARIUM_SESSION_COOKIE, TARIUM_SESSION_COOKIE_VALUE } from '@/lib/auth/session-marker';
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
const SPOTIFY_AUTH_REQUIRED_EVENT = "tarium:spotify-auth-required";

function syncTariumSessionMarker(user: User | null) {
  const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";

  if (user) {
    document.cookie =
      `${TARIUM_SESSION_COOKIE}=${TARIUM_SESSION_COOKIE_VALUE}; Path=/; Max-Age=2592000; SameSite=Lax${secureAttr}`;
    return;
  }

  document.cookie = `${TARIUM_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const loading = authLoading || actionLoading;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const sanitizeHistoryEntry = () => {
      const { changed, sanitizedUrl } = sanitizeSpotifyUrlState(window.location.href);
      if (changed) {
        window.history.replaceState(null, "", sanitizedUrl);
      }
    };

    const applySessionState = (nextSession: Session | null) => {
      if (!alive) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      syncTariumSessionMarker(nextSession?.user ?? null);
      setAuthLoading(false);
    };

    const revalidateSessionState = async () => {
      sanitizeHistoryEntry();

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        applySessionState(data.session);
      } catch (err) {
        if (!alive) return;
        console.error('Error refreshing session:', err);
        setSession(null);
        setUser(null);
        syncTariumSessionMarker(null);
        setAuthLoading(false);
      }
    };

    sanitizeHistoryEntry();

    const handlePopState = () => {
      void revalidateSessionState();
    };

    const handlePageShow = () => {
      void revalidateSessionState();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    const init = async () => {
      try {
        await revalidateSessionState();
      } catch (err) {
        if (!alive) return;
        console.error('Error getting session:', err);
        setError('Error al obtener sesión');
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      syncTariumSessionMarker(nextSession?.user ?? null);
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
      window.removeEventListener("pageshow", handlePageShow);
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

    const signedOutUserId = user?.id ?? session?.user?.id ?? null;
    const warnings: string[] = [];

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        warnings.push('supabase_signout_failed');
        console.error('Sign out error:', error);
      }
    } catch (err: unknown) {
      console.error('Sign out error:', err);
      warnings.push('supabase_signout_failed');
    }

    try {
      const response = await fetch('/api/spotify/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        warnings.push('spotify_logout_failed');
      }
    } catch (err: unknown) {
      console.error('Spotify logout error:', err);
      warnings.push('spotify_logout_failed');
    } finally {
      setSession(null);
      setUser(null);
      syncTariumSessionMarker(null);
      window.dispatchEvent(new CustomEvent(CLEAR_QUEUE_EVENT, {
        detail: { userId: signedOutUserId },
      }));
      window.dispatchEvent(new Event(SPOTIFY_AUTH_REQUIRED_EVENT));

      if (warnings.length > 0) {
        console.warn('Logout global completed with warnings:', warnings);
        setError('Sesión local cerrada, pero algunos servicios no respondieron.');
      }
    }

    setActionLoading(false);
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
