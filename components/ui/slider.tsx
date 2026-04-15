"use client";

import * as React from "react";
import * as RadixSlider from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

export type SliderProps = React.ComponentPropsWithoutRef<typeof RadixSlider.Root>;

export function Slider({ className, ...props }: SliderProps) {
  return (
    <RadixSlider.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <RadixSlider.Track className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]/60">
        <RadixSlider.Range className="absolute h-full bg-[var(--accent)]" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="block h-3.5 w-3.5 rounded-full border border-black/40 bg-white shadow" />
    </RadixSlider.Root>
  );
}
