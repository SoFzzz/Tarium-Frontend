"use client";

import { useEffect, useRef, useState } from "react";

import type { ITrack } from "@/lib/player/types";
import { SearchResultList } from "./SearchResultList";
import { Button } from "@/components/ui/button";

export interface SearchPanelProps {
  className?: string;
  placeholder?: string;
}

export function SearchPanel({ className = "", placeholder = "Buscar con Spotify" }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(trimmed)}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Error al buscar en Spotify");
      }

      const data = (await response.json()) as ITrack[];
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch (err: unknown) {
      console.error("Search error", err);
      setError(err instanceof Error ? err.message : "Error al buscar en Spotify");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section ref={containerRef} className={`relative w-full space-y-3 ${className}`}>
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <input
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setOpen(false);
            }
          }}
          onFocus={() => {
            if (results.length || error) {
              setOpen(true);
            }
          }}
          className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--accent)]"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!query.trim() || loading}
        >
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </form>

      {open && (error || results.length > 0) ? (
        <div className="absolute right-0 z-50 mt-2 w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xl">
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <SearchResultList results={results} />
        </div>
      ) : null}
    </section>
  );
}
