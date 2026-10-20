/**
 * Document values in the shapes the library takes: ISO text as Dates, arrays
 * as Sets, field paths as accessors, delimiter characters as a RegExp, choice
 * lists as `<option>` elements, icon names as icons.
 */

import { createElement, type ReactNode } from "react";

import { isForbiddenSegment, isPlainObject } from "../spec/guards";
import type { DateKind } from "../spec/types";
import { walkSegments } from "../spec/ref-path";
import { ISO_SHAPED, parseIsoDateTime } from "../spec/dates";

/** What a coercion makes of a value it cannot use: dropped, with why. */
export class Refusal {
  constructor(readonly reason: string) {}
}

/** A dot path's segments (`"billing.monthly"`), or null when a segment is empty or forbidden. */
export function fieldSegments(path: unknown): readonly string[] | null {
  if (typeof path !== "string" || path.length === 0) return null;
  const segments = path.split(".");
  return segments.every((segment) => segment.length > 0 && !isForbiddenSegment(segment)) ? segments : null;
}

/**
 * ISO text as the Date (or `{ start, end }` range of Dates) a `kind` prop
 * takes. A value that is not text (a timestamp, `null`, an existing Date) is
 * left for the component. `lenient`: text that does not look like a date is
 * left alone too (chart x values may be category labels).
 */
export function coerceDate(value: unknown, kind: DateKind, lenient: boolean): unknown {
  if (kind === "dateRange") {
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = { ...value };
    for (const end of ["start", "end"] as const) {
      if (!Object.hasOwn(value, end)) continue;
      const parsed = coerceDate(value[end], "datetime", false);
      if (parsed instanceof Refusal) return parsed;
      out[end] = parsed;
    }
    return out;
  }
  if (typeof value !== "string") return value;
  if (lenient && !ISO_SHAPED.test(value)) return value;
  const date = parseIsoDateTime(value);
  return date ?? new Refusal(`"${value}" is not an ISO date (YYYY-MM-DD, or a date-time).`);
}

/** An array as the Set the component takes. */
export function coerceSet(value: unknown): unknown {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set<unknown>(value);
  return new Refusal("Expected an array.");
}

/** Delimiter characters (`",;"`) as a RegExp matching any one of them; never regex source. */
export function coerceDelimiter(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) return new Refusal("Expected a string of delimiter characters.");
  const chars = [...new Set(value)].map((char) => `\\u{${(char.codePointAt(0) ?? 0).toString(16)}}`);
  return new RegExp(`[${chars.join("")}]`, "u");
}

/** `{ value, label, disabled? }` (or a bare string) choices as `<option>` elements; unusable entries are skipped. */
export function optionElements(value: unknown): { readonly options: ReactNode[]; readonly skipped: number } | Refusal {
  if (!Array.isArray(value)) return new Refusal("Expected an array of { value, label } choices.");
  const options: ReactNode[] = [];
  let skipped = 0;
  value.forEach((choice: unknown, index) => {
    if (typeof choice === "string" || typeof choice === "number") {
      options.push(createElement("option", { key: `o${index}`, value: String(choice) }, String(choice)));
      return;
    }
    const valid =
      isPlainObject(choice) &&
      (typeof choice.value === "string" || typeof choice.value === "number") &&
      (typeof choice.label === "string" || typeof choice.label === "number");
    if (!valid) {
      skipped += 1;
      return;
    }
    options.push(
      createElement(
        "option",
        { key: `o${index}`, value: String(choice.value), disabled: choice.disabled === true },
        String(choice.label),
      ),
    );
  });
  return { options, skipped };
}

/** A cell value the table can sort, filter and show: text and numbers; booleans as text; nothing else. */
export function cellValue(value: unknown): string | number | null | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return String(value);
  if (value === null) return null;
  return undefined;
}

/** `(row) => value at path`, own properties only. */
export function accessor(segments: readonly string[]): (row: unknown) => unknown {
  return (row) => walkSegments(row, segments);
}

/** A key that names no row's own value: the position, spelled so it never equals a real key. */
function positionKey(index: number): string {
  return `\u0000${index}`;
}

/**
 * `(row, index) => key` from a field path. A row whose value is missing, not
 * text or a number, or repeats an earlier row's, keys by its position, and a
 * repeat is reported once through `onDuplicate`.
 */
export function rowKeyAccessor(
  segments: readonly string[],
  getRows: () => unknown,
  onDuplicate: (key: string | number) => void,
): (row: unknown, index: number) => string | number {
  const read = accessor(segments);
  let keyed: unknown;
  let keys = new Map<unknown, string | number>();
  const index = (rows: readonly unknown[]) => {
    keys = new Map();
    // By text: 1 and "1" become the same React key.
    const seen = new Set<string>();
    rows.forEach((row, position) => {
      const value = read(row);
      if ((typeof value === "string" || typeof value === "number") && !seen.has(String(value))) {
        seen.add(String(value));
        keys.set(row, value);
      } else {
        if (typeof value === "string" || typeof value === "number") onDuplicate(value);
        keys.set(row, positionKey(position));
      }
    });
  };
  return (row, position) => {
    const rows = getRows();
    if (Array.isArray(rows) && rows !== keyed) {
      keyed = rows;
      index(rows);
    }
    return keys.get(row) ?? positionKey(position);
  };
}

/** `(row) => text` from a field path: the value as text, or "" when it has none. */
export function rowTextAccessor(segments: readonly string[]): (row: unknown) => string {
  const read = accessor(segments);
  return (row) => {
    const value = read(row);
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
}
