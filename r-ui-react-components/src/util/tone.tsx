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
export const TONES = ["neutral", "accent", "error", "success", "warning", "info", "serious", "stale"] as const;
export type Tone = (typeof TONES)[number];

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

/**
 * Text-safe ink for a tone's WORD on a surface or on the tone's own subtle
 * background (>= 4.5:1). Neutral is secondary ink.
 */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-fg-secondary",
  accent: "text-fg-accent",
  error: "text-fg-error",
  success: "text-fg-success",
  warning: "text-fg-warning",
  info: "text-fg-info",
  serious: "text-fg-serious",
  stale: "text-fg-stale",
};

/** The tone's subtle background. Neutral and accent are not states: a quiet surface. */
export const TONE_SUBTLE_BG: Record<Tone, string> = {
  neutral: "bg-surface-1",
  accent: "bg-surface-1",
  error: "bg-status-error-bg",
  success: "bg-status-success-bg",
  warning: "bg-status-warning-bg",
  info: "bg-status-info-bg",
  serious: "bg-status-serious-bg",
  stale: "bg-status-stale-bg",
};

/** A mark-coloured edge (>= 3:1 on surfaces). */
export const TONE_BORDER: Record<Tone, string> = {
  neutral: "border-border-strong",
  accent: "border-accent",
  error: "border-status-error",
  success: "border-status-success",
  warning: "border-status-warning",
  info: "border-status-info",
  serious: "border-status-serious",
  stale: "border-status-stale",
};

/**
 * The tone's fill with its own on-ink, for a filled mark that carries text.
 * Neutral is the inverse pair (primary ink as the fill), not the action fill.
 */
export const TONE_SOLID: Record<Tone, string> = {
  neutral: "bg-fg-primary text-fg-inverse",
  accent: "bg-accent text-fg-on-accent",
  error: "bg-status-error text-fg-on-error",
  success: "bg-status-success text-fg-on-success",
  warning: "bg-status-warning text-fg-on-warning",
  info: "bg-status-info text-fg-on-info",
  serious: "bg-status-serious text-fg-on-serious",
  stale: "bg-status-stale text-fg-on-stale",
};

/**
 * The default word per tone, the one spelling every component speaks or shows
 * (components take overrides through their `labels`). No trailing punctuation:
 * a component that reads it ahead of a message adds its own separator. Neutral
 * says nothing: it is not a state worth announcing.
 */
export const TONE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "",
  accent: "Current",
  error: "Error",
  success: "Success",
  warning: "Warning",
  info: "Info",
  serious: "Serious",
  stale: "Stale",
};

/** Per tone, the classes of every table given, joined (for a part that takes several). */
export function joinToneTables(...tables: Readonly<Record<Tone, string>>[]): Record<Tone, string> {
  return Object.fromEntries(TONES.map((tone) => [tone, tables.map((table) => table[tone]).join(" ")])) as Record<
    Tone,
    string
  >;
}

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
