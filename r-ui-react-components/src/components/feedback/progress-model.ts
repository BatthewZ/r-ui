import { formatPercent, isPresent } from "../../util/format";
import { type Tone, TONE_LABELS } from "../../util/tone";

/*
 * Internal to the feedback group: what ProgressBar and ProgressRing share (the
 * reading of value/max, the words, the spoken text). The labels and the tone
 * type are public through the group's barrel.
 */

/** Stale is not a progress state: a job that stopped reporting is `warning` or indeterminate. */
export type ProgressTone = Exclude<Tone, "stale">;

export interface ProgressLabels {
  /** Spoken (and shown, where the value is visible) while the amount of work is unknown. */
  indeterminate: string;
  /** A segmented bar's value: whole steps done of the total. Receives raw numbers. */
  steps: (done: number, total: number) => string;
  /**
   * The word spoken after the value, per tone ("45%, Error"). Accent and neutral
   * say nothing: they are the ordinary look, not a status. `""` silences one.
   */
  tones: Record<Tone, string>;
}

export const DEFAULT_PROGRESS_LABELS: ProgressLabels = {
  indeterminate: "In progress",
  steps: (done, total) => `${done} of ${total}`,
  tones: { ...TONE_LABELS, accent: "", neutral: "" },
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Progress: ProgressLabels;
  }
}

export type ProgressReading =
  | { determinate: true; value: number; max: number; share: number }
  | { determinate: false };

/**
 * A missing value (`null`, `undefined`, `NaN`) or a `max` that spans nothing is
 * indeterminate: ARIA's answer, which omits `aria-valuenow`. A value past either
 * end is clamped, so the announcement always matches the fill.
 */
export function readProgress(value: number | null | undefined, max: number): ProgressReading {
  if (!isPresent(value) || !Number.isFinite(max) || max <= 0) return { determinate: false };
  const clamped = Math.min(max, Math.max(0, value));
  return { determinate: true, value: clamped, max, share: clamped / max };
}

/**
 * The share as a whole percentage, rounded DOWN: work at 99.6% is not done, and
 * must not read "100%" beside a bar that is not full. The epsilon absorbs float
 * error (0.29 × 100 is 28.999…, which would floor to 28).
 */
export function percentText(share: number, locale: string | undefined): string {
  const floored = Math.floor(share * 100 + 1e-9) / 100;
  return formatPercent(floored, { locale, maximumFractionDigits: 0 });
}

/** The value text, then the tone's word when it has one. */
export function spokenText(text: string, word: string): string {
  return word ? `${text}, ${word}` : text;
}
