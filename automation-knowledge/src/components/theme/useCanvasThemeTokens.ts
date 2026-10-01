"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";

const tokenNames = {
  accent: "--color-accent",
  line: "--color-line",
  surface: "--color-surface",
  ink: "--color-ink",
  inkSoft: "--color-ink-soft",
  noteSurface: "--note-surface",
  sectionFill: "--canvas-section-fill",
  sectionStroke: "--canvas-section-stroke",
  headingFill: "--canvas-heading-fill",
  headingStroke: "--canvas-heading-stroke",
  accentGhost: "--canvas-accent-ghost",
  accentLine: "--canvas-accent-line",
  shadowColor: "--canvas-shadow-color",
  annotationRed: "--annotation-red",
  annotationBlue: "--annotation-blue",
  annotationGreen: "--annotation-green",
  annotationYellow: "--annotation-yellow",
} as const;

export function useCanvasThemeTokens() {
  const { resolvedTheme } = useTheme();

  return useMemo(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return null;
    if (typeof document === "undefined") return null;
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      Object.entries(tokenNames).map(([key, name]) => [key, styles.getPropertyValue(name).trim()])
    ) as Record<keyof typeof tokenNames, string>;
  }, [resolvedTheme]);
}
