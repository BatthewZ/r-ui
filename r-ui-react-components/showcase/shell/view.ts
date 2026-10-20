/**
 * The showcase's View settings, as a consumer app configures the library's
 * preferences API: its own storage key and its own theme list. Theme, density
 * and input are applied to <html> by `useTheme` / `useDensity` /
 * `useInputMode` (through the switchers) and restored before first paint by
 * `themeScript`, which the Vite config inlines into index.html.
 *
 * The theme names are listed here because the showcase is a consumer app that
 * chose to import those theme files: the CSS package's examples, then its own
 * (showcase/themes/). The library itself never names them.
 *
 * No React in this module, and its imports carry extensions: vite.config.ts imports it.
 */
import type { ThemeConfig } from "../../src/util/preferences.ts";

/**
 * The browser checks write `{ theme, density, input }` under this key to set the
 * View, and read THEMES from `<html data-showcase-themes>` (vite.config.ts).
 */
export const STORAGE_KEY = "r-ui-showcase:view";

export const THEMES = [
  { value: "default", label: "Default" },
  { value: "nightfall", label: "Nightfall" },
  { value: "harbour", label: "Harbour" },
  { value: "atelier", label: "Atelier" },
  { value: "meridian", label: "Meridian" },
  { value: "ops", label: "Ops" },
  { value: "ocean", label: "Ocean" },
  { value: "meadow", label: "Meadow" },
  { value: "sandstone", label: "Sandstone" },
  { value: "neon", label: "Neon" },
  { value: "marquee", label: "Marquee" },
  { value: "apex", label: "Apex" },
  { value: "cinder", label: "Cinder" },
] as const;

/** What the hooks, the switchers and the pre-paint script all receive. */
export const PREFERENCES = {
  storageKey: STORAGE_KEY,
  themes: THEMES.map((t) => t.value),
} satisfies ThemeConfig;

/** The tokens the readout shows, resolved at <html>. */
export const READOUT_TOKENS = ["--CONTROL-H", "--ROW-H", "--HIT-MIN", "--R-SIZE-3", "--BodyText-1"] as const;

export interface Reading {
  token: (typeof READOUT_TOKENS)[number];
  /** The computed custom-property value (`0.75rem`, or px for @property-registered tokens). */
  value: string;
  /** The same length resolved to px, via a probe element. */
  px: string;
}

/**
 * Resolve each readout token to its computed value and to px. A probe element
 * appended to <body> gets `inline-size: var(--X)` and reports its used width,
 * which turns any length (rem, max(), calc()) into px. Root-level, so it reads
 * the page's own density and input, which is what the View panel sets.
 */
export function readTokens(doc: Document = document): Reading[] {
  const rootStyle = getComputedStyle(doc.documentElement);
  const probe = doc.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.blockSize = "0";
  doc.body.append(probe);
  try {
    return READOUT_TOKENS.map((token) => {
      probe.style.inlineSize = `var(${token})`;
      const px = getComputedStyle(probe).inlineSize;
      return { token, value: rootStyle.getPropertyValue(token).trim() || "unset", px };
    });
  } finally {
    probe.remove();
  }
}
