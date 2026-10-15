"use client";
import { type KeyboardEvent, type ReactNode, useState } from "react";

import { ErrorLine } from "../../util/error-line";
import { cn } from "../../util/style";
import { DEFAULT_CALENDAR_LABELS, type CalendarLabels } from "./calendar-base";
import {
  DEFAULT_FORMAT_LETTERS,
  dateFormatter,
  type FormatLetters,
  formatInputDate,
  isOutOfBounds,
  parseDate,
} from "./date-core";

/** Why typed text was refused. */
export type DateRejection = "unparseable" | "outOfRange" | "unavailable";

/** The strings a typed date field speaks, on top of the calendar's. */
export interface DateEntryLabels extends CalendarLabels {
  /** The letters of the format hint; separators come from the locale ("TT.MM.JJJJ" in German). */
  formatLetters: FormatLetters;
  /** The visible hint under the field, from the pattern ("MM/DD/YYYY"). */
  hint: (pattern: string) => string;
  /** Typed text that names no date. */
  unparseable: (text: string, pattern: string) => string;
  /** A date outside `min`/`max`; each bound already formatted, `undefined` when open. */
  outOfRange: (bounds: { min?: string; max?: string }) => string;
  /** A date `isDateUnavailable` refuses, formatted. */
  unavailable: (date: string) => string;
}

export const DEFAULT_DATE_ENTRY_LABELS: DateEntryLabels = {
  ...DEFAULT_CALENDAR_LABELS,
  formatLetters: DEFAULT_FORMAT_LETTERS,
  hint: (pattern) => pattern,
  unparseable: (text, pattern) => `“${text}” is not a date. Use ${pattern}.`,
  outOfRange: ({ min, max }) =>
    min && max ? `Choose a date from ${min} to ${max}.` : min ? `Choose ${min} or later.` : `Choose ${max} or earlier.`,
  unavailable: (date) => `${date} is not available.`,
};

/** Typed text a field refused, and why. */
export interface RejectedEntry {
  reason: DateRejection;
  text: string;
}

export interface DateRules {
  locale: string;
  min?: Date;
  max?: Date;
  isDateUnavailable?: (date: Date) => boolean;
}

/** Why `date` cannot be chosen under `rules`, or `null`. */
export function rejectionFor(date: Date | null, rules: DateRules): DateRejection | null {
  if (!date) return "unparseable";
  if (isOutOfBounds(date, rules.min, rules.max)) return "outOfRange";
  if (rules.isDateUnavailable?.(date)) return "unavailable";
  return null;
}

export function rejectionMessage({ reason, text }: RejectedEntry, pattern: string, rules: DateRules, labels: DateEntryLabels): string {
  const long = (d: Date) => dateFormatter(rules.locale, { dateStyle: "medium" }).format(d);
  if (reason === "unparseable") return labels.unparseable(text, pattern);
  if (reason === "outOfRange") {
    return labels.outOfRange({ min: rules.min && long(rules.min), max: rules.max && long(rules.max) });
  }
  const parsed = parseDate(text, rules.locale);
  return labels.unavailable(parsed ? long(parsed) : text);
}

/**
 * Typed entry for one date: the text shown, and the commit on blur or Enter.
 *
 * The text is the committed value formatted, until the user types; then it is the
 * draft until a commit. A refused draft STAYS in the field (the user corrects it
 * rather than retyping) with its reason; editing clears the reason. Blank commits
 * `null`.
 */
export function useDateText({
  value,
  onCommit,
  rules,
}: {
  value: Date | null;
  onCommit: (date: Date | null) => void;
  rules: DateRules;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [rejected, setRejected] = useState<RejectedEntry | null>(null);
  const text = draft ?? (value ? formatInputDate(value, rules.locale) : "");

  const commit = () => {
    if (draft === null) return;
    if (draft.trim() === "") {
      setDraft(null);
      setRejected(null);
      onCommit(null);
      return;
    }
    const parsed = parseDate(draft, rules.locale);
    const reason = rejectionFor(parsed, rules);
    if (reason) {
      setRejected({ reason, text: draft });
      return;
    }
    setDraft(null);
    setRejected(null);
    onCommit(parsed);
  };

  return {
    text,
    rejected,
    /** Drop the draft and any refusal (the value was set some other way). */
    reset: () => {
      setDraft(null);
      setRejected(null);
    },
    inputProps: {
      value: text,
      onChange: (event: { target: { value: string } }) => {
        setDraft(event.target.value);
        setRejected(null);
      },
      onBlur: commit,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        // Nothing pending (or already refused, unedited): Enter keeps its native
        // job of submitting the form.
        if (event.key !== "Enter" || draft === null || rejected?.text === draft) return;
        event.preventDefault();
        commit();
      },
    },
  };
}

/**
 * The line under a typed date field: the error when there is one, in the Field
 * error's look (icon, error ink), else the format hint. Both are referenced from
 * the input's `aria-describedby`. The error line is a polite live region, mounted
 * empty, because it appears while the user stays in the field (Enter).
 */
export function EntryMessages({
  hintId,
  errorId,
  hint,
  error,
  classNames,
}: {
  hintId: string;
  errorId: string;
  hint: ReactNode;
  error: string | null;
  classNames?: { hint?: string; error?: string };
}) {
  return (
    <>
      <ErrorLine id={errorId} aria-live="polite" icon={error ? undefined : null} className={cn(!error && "sr-only", classNames?.error)}>
        {error}
      </ErrorLine>
      {hint != null && hint !== false && !error && (
        <p id={hintId} className={cn("text-body-2 text-fg-muted", classNames?.hint)}>
          {hint}
        </p>
      )}
    </>
  );
}
