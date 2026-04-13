"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { AuthProvider } from "@/providers/AuthProvider";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      enableColorScheme={false}
    >
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
