"use client";

import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({ children, ...props }: RadixTooltip.TooltipProps) {
  return <RadixTooltip.Root {...props}>{children}</RadixTooltip.Root>;
}

export const TooltipTrigger = RadixTooltip.Trigger;

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] shadow-lg",
        className,
      )}
      {...props}
    />
  </RadixTooltip.Portal>
));

TooltipContent.displayName = "TooltipContent";
