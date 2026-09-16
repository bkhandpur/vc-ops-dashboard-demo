"use client";

import { useColorMode } from "@/components/theme/ThemeProvider";

import { fillFor } from "./colors";

/**
 * The small colour dot that carries a theme's identity outside a chart — beside a search
 * result, a table row, a logo tile, a founder card.
 *
 * Extracted so every view uses the same one. The rule from colors.ts is that hue means
 * theme and nothing else; a view that hand-rolled its own dot would be one refactor away
 * from breaking that. It is decorative here (the label always sits next to it), so it is
 * `aria-hidden` and identity is never colour-alone.
 */
export function ThemeSwatch({ theme, size = 8 }: { theme: string; size?: number }) {
  const mode = useColorMode();
  return (
    <span
      aria-hidden
      title={theme}
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: fillFor(theme, 0, mode) }}
    />
  );
}
