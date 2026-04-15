export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
  try {
    if (!artist?.trim() || !title?.trim()) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { signal: controller.signal },
    ).finally(() => clearTimeout(timeoutId));

    // 404 is a normal "no lyrics" case.
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { lyrics?: string };
    return data.lyrics ?? null;
  } catch {
    return null;
  }
}
