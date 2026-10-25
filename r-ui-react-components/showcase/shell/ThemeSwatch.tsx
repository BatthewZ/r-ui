import type { CSSProperties } from "react";

import { cn } from "../../src/util/style";

import { type Palette, readPalettes } from "./palettes";
import { PREFERENCES } from "./view";

let cached: Map<string, Palette> | null = null;

/** Every listed theme's swatch colours. The stylesheets are in before the first render (main imports them), and a theme's colours never change, so they are read once. */
export function themePalettes(): Map<string, Palette> {
  cached ??= readPalettes(PREFERENCES.themes);
  return cached;
}

/**
 * A theme at a glance: its page surface as a disc, its primary and accent split across a
 * smaller one inside. Decorative; whatever holds it names the theme.
 */
export function ThemeSwatch({ theme, className }: { theme: string; className?: string }) {
  const palette = themePalettes().get(theme);
  const style = palette
    ? ({ "--sw-surface": palette.surface, "--sw-primary": palette.primary, "--sw-accent": palette.accent } as CSSProperties)
    : undefined;
  return <span className={cn("sc-swatch", className)} style={style} aria-hidden />;
}
