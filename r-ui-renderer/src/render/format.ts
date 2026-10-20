/**
 * FormatSpec → text, on the library's formatters and the host's locale. One
 * function serves `$format` (a value) and every formatter prop (a function
 * the component calls).
 */

import {
  formatBytes,
  formatCompact,
  formatDelta,
  formatNumber,
  type FormatNumberOptions,
  formatPercent,
  formatUnit,
  MISSING,
} from "@batthewz/r-ui-react-components";

import { isPlainObject } from "../spec/guards";
import { FORMAT_STYLES, type FormatOptions, type FormatStyle } from "../spec/types";
import { parseIsoDateTime, parseIsoDateTimeUtc } from "../spec/dates";

const STYLES: ReadonlySet<string> = new Set<string>(FORMAT_STYLES);

const NUMBER_OPTIONS = [
  "notation",
  "minimumFractionDigits",
  "maximumFractionDigits",
  "maximumSignificantDigits",
  "signDisplay",
  "currencyDisplay",
  "unitDisplay",
  "useGrouping",
] as const;

const OPTION_KEYS: ReadonlySet<string> = new Set([
  "style",
  "currency",
  "unit",
  ...NUMBER_OPTIONS,
  "dateStyle",
  "timeStyle",
  "timeZone",
  "missing",
]);

/** The spec as options, or null when it names no style. Unknown keys are left out. */
export function toFormatOptions(spec: unknown): FormatOptions | null {
  if (typeof spec === "string") return STYLES.has(spec) ? { style: spec as FormatStyle } : null;
  if (!isPlainObject(spec) || typeof spec.style !== "string" || !STYLES.has(spec.style)) return null;
  const options: Record<string, unknown> = {};
  for (const key of Object.keys(spec)) if (OPTION_KEYS.has(key)) options[key] = spec[key];
  return options as unknown as FormatOptions;
}

type DateFields = Pick<FormatOptions, "dateStyle" | "timeStyle">;

const DATE_DEFAULTS: { readonly [S in "date" | "datetime" | "time"]: DateFields } = {
  date: { dateStyle: "medium" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
  time: { timeStyle: "short" },
};

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify([locale ?? null, options]);
  let format = dateFormats.get(key);
  if (format === undefined) {
    if (dateFormats.size >= 128) dateFormats.clear();
    try {
      format = new Intl.DateTimeFormat(locale, options);
    } catch {
      // A malformed host locale: the runtime's default, as the library's formatters do.
      format = new Intl.DateTimeFormat(undefined, options);
    }
    dateFormats.set(key, format);
  }
  return format;
}

function toDate(value: unknown, utc: boolean): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value === "string") return utc ? parseIsoDateTimeUtc(value) : parseIsoDateTime(value);
  return null;
}

function formatDate(value: unknown, style: "date" | "datetime" | "time", options: FormatOptions, locale: string | undefined): string {
  const utc = options.timeZone === "UTC";
  const date = toDate(value, utc);
  const missing = options.missing ?? MISSING;
  if (date === null) return missing;
  const defaults = DATE_DEFAULTS[style];
  const fields: Intl.DateTimeFormatOptions = {};
  const dateStyle = style === "time" ? undefined : (options.dateStyle ?? defaults.dateStyle);
  const timeStyle = style === "date" ? undefined : (options.timeStyle ?? defaults.timeStyle);
  if (dateStyle !== undefined) fields.dateStyle = dateStyle;
  if (timeStyle !== undefined) fields.timeStyle = timeStyle;
  if (utc) fields.timeZone = "UTC";
  return dateFormat(locale, fields).format(date);
}

function numberOptions(options: FormatOptions, locale: string | undefined): FormatNumberOptions {
  const out: Record<string, unknown> = { locale, missing: options.missing ?? MISSING };
  for (const key of NUMBER_OPTIONS) if (options[key] !== undefined) out[key] = options[key];
  return out as FormatNumberOptions;
}

function formatStrict(value: unknown, options: FormatOptions, locale: string | undefined): string {
  const { style } = options;
  if (style === "date" || style === "datetime" || style === "time") return formatDate(value, style, options, locale);
  const n = typeof value === "number" ? value : undefined;
  const base = numberOptions(options, locale);
  switch (style) {
    case "number":
      return formatNumber(n, base);
    case "integer":
      return formatNumber(n, { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 });
    case "compact": {
      const { notation: _notation, ...rest } = base;
      return formatCompact(n, rest);
    }
    case "percent":
      return formatPercent(n, base);
    case "delta": {
      const { signDisplay: _signDisplay, ...rest } = base;
      return formatDelta(n, rest);
    }
    case "bytes":
      return formatBytes(n, base);
    case "currency":
      return formatNumber(n, { ...base, style: "currency", currency: options.currency });
    case "unit":
      return formatUnit(n, options.unit ?? "", base);
  }
}

/** Whether `options` formats without Intl refusing them (an unknown currency or unit, crossed digit bounds). */
export function formatOptionsWork(options: FormatOptions, locale: string | undefined): boolean {
  try {
    formatStrict(options.style === "date" || options.style === "datetime" || options.style === "time" ? 0 : 1, options, locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * `value` as `options` say, in `locale`. Never throws: options Intl refuses
 * fall back to plain number formatting, and a value of the wrong kind is
 * the `missing` text.
 */
export function formatWith(value: unknown, options: FormatOptions, locale: string | undefined): string {
  try {
    return formatStrict(value, options, locale);
  } catch {
    if (typeof value !== "number") return options.missing ?? MISSING;
    try {
      return formatNumber(value, { locale, missing: options.missing ?? MISSING });
    } catch {
      return String(value);
    }
  }
}

/** A formatter for the spec, or null when it names no style. */
export function createFormatter(spec: unknown, locale: string | undefined): ((value: unknown) => string) | null {
  const options = toFormatOptions(spec);
  if (options === null) return null;
  return (value: unknown) => formatWith(value, options, locale);
}
