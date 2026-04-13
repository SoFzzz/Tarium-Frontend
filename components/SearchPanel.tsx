"use client";

import { useEffect, useRef, useState } from "react";

import { searchDeezer } from "@/lib/deezer";
import type { DeezerSearchResult } from "@/lib/player/types";
import { SearchResultList } from "./SearchResultList";
import { Button } from "@/components/ui/button";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DeezerSearchResult[]>([]);
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
      const data = await searchDeezer(trimmed);
      setResults(data);
      setOpen(true);
    } catch (err: any) {
      console.error("Search error", err);
      setError(err?.message || "Error al buscar en Deezer");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section ref={containerRef} className="relative w-full space-y-3">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <input
          placeholder="Buscar con Deezer"
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
