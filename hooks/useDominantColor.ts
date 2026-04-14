"use client";

import { useEffect, useState } from "react";

const DEFAULT_COLOR = "rgba(var(--brand-primary-rgb), 0.6)";

/**
 * Extracts the dominant color from an image URL using colorthief.
 * Returns an RGB string like "rgb(74, 189, 181)" for use in gradients.
 */
export function useDominantColor(imageUrl: string | undefined | null): string {
  const [color, setColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    if (!imageUrl) {
      setColor(DEFAULT_COLOR);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = async () => {
      try {
        // Dynamic import to avoid SSR issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import("colorthief");
        const ColorThief = mod.default ?? mod;
        const thief = new ColorThief();
        const [r, g, b] = thief.getColor(img);
        setColor(`rgb(${r},${g},${b})`);
      } catch {
        setColor(DEFAULT_COLOR);
      }
    };

    img.onerror = () => setColor(DEFAULT_COLOR);
  }, [imageUrl]);

  return color;
}
