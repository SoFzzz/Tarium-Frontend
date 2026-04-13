"use client";

import { useState } from "react";
import { Input, Button, Spinner } from "@heroui/react";

import { searchYouTube } from "@/lib/youtube";
import type { YouTubeSearchResult } from "@/lib/player/types";
import { SearchResultList } from "./SearchResultList";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const data = await searchYouTube(trimmed);
      setResults(data);
    } catch (err: any) {
      console.error("Search error", err);
      setError(err?.message || "Error al buscar en YouTube");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <Input
          size="sm"
          radius="full"
          variant="bordered"
          placeholder="Buscar en YouTube (no se reproduce, solo metadatos)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          radius="full"
          isDisabled={!query.trim() || loading}
        >
          {loading ? <Spinner size="sm" /> : "Buscar"}
        </Button>
      </form>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <SearchResultList results={results} />
    </section>
  );
}
