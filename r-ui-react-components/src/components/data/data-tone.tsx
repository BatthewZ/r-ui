import { cn } from "../../util/style";
import { MARK_TEXT, type Tone, ToneGlyph } from "../../util/tone";

/*
 * Internal to the data group (not exported from its index). Glyphs and mark
 * colours come from the shared tone vocabulary (`util/tone`), so a meter, a stat
 * card and a `StatusLabel` in a cell draw the same state the same way. Only what
 * is data-specific lives here.
 */

/** Fill colours for bars (meter fills): the tone marks as backgrounds; neutral is series 1. */
export const STATUS_FILL: Record<Tone, string> = {
  neutral: "bg-series-1",
  accent: "bg-accent",
  success: "bg-status-success",
  info: "bg-status-info",
  warning: "bg-status-warning",
  serious: "bg-status-serious",
  error: "bg-status-error",
  stale: "bg-status-stale",
};

/** The spoken word for a measured state, for places the label is not visible. */
export const STATUS_WORD: Record<Tone, string> = {
  neutral: "",
  accent: "",
  success: "Healthy",
  info: "Info",
  warning: "Warning",
  serious: "Serious",
  error: "Critical",
  stale: "Stale",
};

/** The tone's mark alone, decorative. Pair it with a visible or spoken label. */
export function StatusIcon({ tone, className }: { tone: Tone; className?: string }) {
  return <ToneGlyph tone={tone} className={cn("size-icon shrink-0", MARK_TEXT[tone], className)} />;
}
