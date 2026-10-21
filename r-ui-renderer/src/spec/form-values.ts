/**
 * How a JSON value becomes a form field's control value: the forms seed their
 * fields with it and the validator warns where it refuses, so the two read
 * one rule. Absent (`undefined`) and `null` are the type's empty value.
 */

import { parseIsoDate } from "./dates";
import { isPlainObject } from "./guards";
import type { FieldType } from "./types";

export type FieldValueResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string };

const EMPTY: { readonly [T in FieldType]: () => unknown } = {
  text: () => "",
  number: () => null,
  boolean: () => false,
  date: () => null,
  dateRange: () => null,
  list: () => [],
};

const EXPECTED: { readonly [T in FieldType]: string } = {
  text: "text, or a number",
  number: "a number, or numeric text",
  boolean: "true or false",
  date: 'an ISO date ("2026-11-02")',
  dateRange: '{ "start", "end" } of ISO dates (or null)',
  list: "an array of strings",
};

/** A finite number from a number or numeric text; undefined otherwise. */
export function numberOf(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

/** A date end: a valid Date, or ISO text; `null` (and absent) stays empty. */
function dateOf(value: unknown): Date | null | undefined {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  return typeof value === "string" ? (parseIsoDate(value) ?? undefined) : undefined;
}

function convert(type: FieldType, value: unknown): unknown {
  switch (type) {
    case "text":
      return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
    case "number":
      return numberOf(value);
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "date":
      return dateOf(value) ?? undefined;
    case "dateRange": {
      if (!isPlainObject(value)) return undefined;
      const start = dateOf(value.start);
      const end = dateOf(value.end);
      return start === undefined || end === undefined ? undefined : { start, end };
    }
    case "list":
      return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : undefined;
  }
}

/**
 * `value` as a `type` field's control holds it (Dates for date fields), or
 * why it cannot be one; the forms then use the type's empty value, which
 * `coerceFieldValue(type, undefined)` gives.
 */
export function coerceFieldValue(type: FieldType, value: unknown): FieldValueResult {
  if (value === undefined || value === null) return { ok: true, value: EMPTY[type]() };
  const converted = convert(type, value);
  if (converted === undefined) return { ok: false, reason: `Not a ${type} field's value (${EXPECTED[type]}).` };
  return { ok: true, value: converted };
}
