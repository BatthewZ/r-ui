"use client";
import { useState } from "react";

/** The most fraction digits a number field keeps (`toFixed`'s ceiling is 100; doubles carry ~17). */
export const MAX_DIGITS = 20;

export function clampNumber(n: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

export const roundTo = (n: number, digits: number) => Number(n.toFixed(Math.min(digits, MAX_DIGITS)));

export interface NumberDraftParams {
  /** The committed value. */
  current: number | null;
  setValue: (value: number | null) => void;
  /** The committed value as the field shows it. */
  format: (value: number | null) => string;
  /** Typed text to a number: `null` for an empty field, `NaN` for unreadable text. */
  parse: (text: string) => number | null;
  /** A parsed number as it is committed (rounded, clamped). */
  settle: (value: number) => number;
  /** Disabled or read-only: focus opens no draft and nothing commits. */
  locked: boolean;
}

/**
 * The editing model the number fields share: while focused the field holds the
 * typed text (a draft), committed on blur or Enter, never mid-typing. An
 * unedited draft commits nothing (the display may hold fewer digits than the
 * value), unreadable text keeps the last good value, an empty field commits
 * `null`. `setDraft` lets a caller replace the draft (a stepper press).
 */
export function useNumberDraft({ current, setValue, format, parse, settle, locked }: NumberDraftParams) {
  // The text being edited, or `null` when the field shows the committed value.
  const [draft, setDraft] = useState<string | null>(null);

  /** Commits `text`. Returns whether the field may show the committed value again. */
  const commit = (text: string): boolean => {
    if (text === format(current)) return true;
    const parsed = parse(text);
    if (Number.isNaN(parsed)) return false;
    setValue(parsed === null ? null : settle(parsed));
    return true;
  };

  return {
    draft,
    setDraft,
    text: draft ?? format(current),
    /** Enter: commit and show the committed value (rounded, clamped), not what was typed. */
    commitDraft: () => {
      if (draft !== null && !locked && commit(draft)) setDraft(null);
    },
    onFocus: (text: string) => {
      if (!locked) setDraft(text);
    },
    onChange: (text: string) => setDraft(text),
    onBlur: () => {
      if (draft !== null && !locked) commit(draft);
      setDraft(null);
    },
  };
}
