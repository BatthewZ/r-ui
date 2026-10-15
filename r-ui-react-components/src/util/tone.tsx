import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Info,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";

/*
 * The tone vocabulary every group shares (internal: not re-exported from
 * `util/index`; the types are public through the primitives barrel). One
 * meaning, one glyph and one mark colour per tone, wherever a tone is drawn.
 */

/**
 * What a tone MEANS. `accent` is "current / selected", never a status; `serious`
 * sits between warning and error; `stale` means "this value is old".
 */
export type Tone = "neutral" | "accent" | "error" | "success" | "warning" | "info" | "serious" | "stale";

/** Tones that report a state. `accent` is excluded: it marks interaction, not state. */
export type StatusTone = Exclude<Tone, "accent">;

/**
 * Ink for a tone's mark (icon, dot, outline) on a surface or on the tone's own
 * subtle background: every value is a >= 3:1 mark or a >= 4.5:1 text token.
 * Literal strings so Tailwind's scanner sees each utility.
 */
export const MARK_TEXT: Record<Tone, string> = {
  neutral: "text-fg-secondary",
  accent: "text-accent",
  error: "text-status-error",
  success: "text-status-success",
  warning: "text-status-warning",
  info: "text-status-info",
  serious: "text-status-serious",
  stale: "text-status-stale",
};

/** One distinct SHAPE per tone, so a status survives without colour. */
export const TONE_GLYPH: Record<Tone, LucideIcon> = {
  neutral: CircleDashed,
  accent: CircleDot,
  error: CircleX,
  success: CircleCheck,
  warning: TriangleAlert,
  info: Info,
  serious: CircleAlert,
  stale: Clock,
};

/** The tone's default glyph, decorative: the label next to it names the state. */
export function ToneGlyph({ tone, className }: { tone: Tone; className?: string }) {
  const Glyph = TONE_GLYPH[tone];
  return <Glyph aria-hidden className={className} />;
}
