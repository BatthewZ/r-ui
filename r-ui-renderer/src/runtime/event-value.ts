import { toISODate, toISODateTime } from "@batthewz/r-ui-react-components";

import { isPlainObject } from "../spec/guards";
import { FORBIDDEN_SEGMENTS, type EventValueKind, type JsonValue } from "../spec/types";

/** How a Date becomes text: by whether it sits at local midnight, or always as a day or an instant. */
export type DateMode = "auto" | "date" | "datetime";

const FORBIDDEN: ReadonlySet<string> = new Set<string>(FORBIDDEN_SEGMENTS);

/** Deeper than any value a component reports; past it a branch is dropped rather than walked forever. */
const MAX_DEPTH = 32;

function isLocalMidnight(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

export function dateToJson(date: Date, mode: DateMode): string | null {
  if (Number.isNaN(date.getTime())) return null;
  if (mode === "date" || (mode === "auto" && isLocalMidnight(date))) return toISODate(date);
  return toISODateTime(date, { seconds: true });
}

/**
 * `value` as JSON: Dates to ISO text (never through `Date#toJSON`, which is
 * UTC and shifts a calendar day east of Greenwich), Sets to arrays, anything
 * JSON cannot hold (functions, class instances, DOM nodes, non-finite
 * numbers) dropped from objects and `null` in arrays.
 */
export function toJsonValue(value: unknown, mode: DateMode = "auto"): JsonValue | undefined {
  return convert(value, mode, 0);
}

function convert(value: unknown, mode: DateMode, depth: number): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object" || depth > MAX_DEPTH) return undefined;
  if (value instanceof Date) return dateToJson(value, mode);
  if (Array.isArray(value) || value instanceof Set) {
    return Array.from(value as Iterable<unknown>, (item) => convert(item, mode, depth + 1) ?? null);
  }
  if (!isPlainObject(value)) return undefined;
  const out: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.has(key)) continue;
    const item = convert(value[key], mode, depth + 1);
    if (item !== undefined) out[key] = item;
  }
  return out;
}

function isDomEvent(value: unknown): value is { readonly target: unknown } {
  if (typeof value !== "object" || value === null) return false;
  if (typeof Event !== "undefined" && value instanceof Event) return true;
  // React's synthetic events wrap the native one.
  return "nativeEvent" in value && "target" in value;
}

/** A form control's value as its event reports it. */
function targetValue(target: unknown, kind: EventValueKind): unknown {
  if (typeof HTMLInputElement !== "undefined" && target instanceof HTMLInputElement) {
    if (kind === "checked" || target.type === "checkbox" || target.type === "radio") return target.checked;
    if (target.type === "number" || target.type === "range") {
      if (target.value === "") return null;
      const number = Number(target.value);
      return Number.isNaN(number) ? target.value : number;
    }
    return target.value;
  }
  if (typeof HTMLSelectElement !== "undefined" && target instanceof HTMLSelectElement && target.multiple) {
    return Array.from(target.selectedOptions, (option) => option.value);
  }
  if (typeof HTMLTextAreaElement !== "undefined" && target instanceof HTMLTextAreaElement) return target.value;
  if (typeof HTMLSelectElement !== "undefined" && target instanceof HTMLSelectElement) return target.value;
  return undefined;
}

function modeFor(kind: EventValueKind): DateMode {
  if (kind === "date" || kind === "dateRange") return "date";
  if (kind === "datetime") return "datetime";
  return "auto";
}

/** One callback argument as JSON, a DOM event unwrapped first. */
function readArgument(arg: unknown, kind: EventValueKind): JsonValue | undefined {
  const value = isDomEvent(arg) ? targetValue(arg.target, kind) : arg;
  return toJsonValue(value, modeFor(kind));
}

/**
 * `event.value` from a callback's arguments, as JSON: a DOM event unwrapped to
 * its target's value (`checked` for a checkbox or radio), a Set to an array, a
 * Date to `YYYY-MM-DD` at local midnight and to an ISO instant otherwise.
 */
export function readEventValue(args: readonly unknown[], kind: EventValueKind = "value"): JsonValue | undefined {
  return args.length === 0 ? undefined : readArgument(args[0], kind);
}

/** `event.args`: every argument, made JSON the way `readEventValue` makes the first. */
export function readEventArgs(args: readonly unknown[], kind: EventValueKind = "value"): JsonValue[] {
  return args.map((arg) => readArgument(arg, kind) ?? null);
}
