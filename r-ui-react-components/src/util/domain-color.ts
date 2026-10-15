/**
 * The CSS value of a domain colour, for the places a utility cannot reach: an
 * SVG gradient `stop-color`, an inline `style`, a canvas or charting library
 * fed through `getComputedStyle` on an element styled with it.
 *
 * Prefer the utility (`bg-series-1`, `stroke-chart-grid`): it emits the same
 * expression. This exists so nobody hand-writes the blend, or reads one half of
 * a pair (`var(--C-SERIES-1-DARK)`), which ignores the theme's scheme and is
 * rejected by `scripts/verify-domain-pairs.mjs`.
 *
 * The value resolves where it is USED, so it follows the element's theme.
 */
export const DOMAIN_COLORS = [
  "SERIES-1",
  "SERIES-2",
  "SERIES-3",
  "SERIES-4",
  "SERIES-5",
  "SERIES-6",
  "SERIES-7",
  "SERIES-8",
  "SEQ-1",
  "SEQ-2",
  "SEQ-3",
  "SEQ-4",
  "SEQ-5",
  "SEQ-6",
  "SEQ-7",
  "TREND-GOOD",
  "TREND-BAD",
  "STATUS-SERIOUS",
  "TEXT-SERIOUS",
  "STATUS-SERIOUS-BG",
  "TEXT-ON-SERIOUS",
  "STATUS-STALE",
  "TEXT-STALE",
  "STATUS-STALE-BG",
  "TEXT-ON-STALE",
  "CHART-GRID",
  "CHART-AXIS",
  "CODE-KEYWORD",
  "CODE-STRING",
  "CODE-NUMBER",
  "CODE-FUNCTION",
  "CODE-TYPE",
] as const;

export type DomainColor = (typeof DOMAIN_COLORS)[number];

/** `domainColor("SERIES-1")` -> the scheme-blended CSS value of `--C-SERIES-1-LIGHT/-DARK`. */
export function domainColor(name: DomainColor): string {
  return `color-mix(in oklch, var(--C-${name}-LIGHT), var(--C-${name}-DARK) calc(var(--SCHEME-DARK) * 100%))`;
}

/** The series colour for a 1-based slot. Slots past 8 are a caller bug: fold to "Other". */
export function seriesColor(slot: number): string {
  if (!Number.isInteger(slot) || slot < 1 || slot > 8) {
    throw new RangeError(`seriesColor: slot ${slot} is outside 1..8; fold extra series into "Other".`);
  }
  return domainColor(`SERIES-${slot}` as DomainColor);
}
