/**
 * Locale-aware number formatting for data UI: tables, KPIs, meters, axes.
 *
 * Every formatter here:
 * - goes through `Intl.NumberFormat`, so grouping, decimal marks, the minus
 *   sign, compact suffixes and unit names follow the locale (pass `locale`, or
 *   omit it for the runtime's default);
 * - renders a MISSING value (`null`, `undefined`, `NaN`, ±Infinity) as
 *   `MISSING` ("—", an em dash) rather than "NaN" or "0", because a missing
 *   value and a zero mean different things on a dashboard;
 * - never prints a negative zero: a value that rounds to 0 renders "0", not
 *   "-0" (`signDisplay: "negative"` is the default; pass another to change it);
 * - makes compact notation an explicit choice (`formatCompact`), never a
 *   silent default: "1.2K" loses precision a table reader may need.
 *
 * Formatters are cached per locale + options, so a 10k-row table does not
 * construct 10k `Intl.NumberFormat`s.
 */

/** What every formatter renders for a value that is not there. */
export const MISSING = "—";

export interface FormatNumberOptions
  extends Pick<
    Intl.NumberFormatOptions,
    | "minimumFractionDigits"
    | "maximumFractionDigits"
    | "maximumSignificantDigits"
    | "signDisplay"
    | "notation"
    | "style"
    | "unit"
    | "unitDisplay"
    | "currency"
    | "currencyDisplay"
    | "useGrouping"
  > {
  /** BCP 47 locale(s). Omitted: the runtime default. */
  locale?: string | readonly string[];
  /** Text for a missing value. Defaults to `MISSING` ("—"). */
  missing?: string;
}

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: FormatNumberOptions["locale"], options: Intl.NumberFormatOptions) {
  const key = JSON.stringify([locale ?? null, options]);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

/**
 * A default fraction cap that never undercuts the caller's own minimum: Intl
 * throws when `maximumFractionDigits` is below `minimumFractionDigits`.
 */
function fractionCap(digits: number, options: Pick<FormatNumberOptions, "minimumFractionDigits">): number {
  return Math.max(digits, options.minimumFractionDigits ?? 0);
}

/** True for a value a formatter can render as a number. */
export function isPresent(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The general case: `formatNumber(1234.5, { locale: "en-US" })` -> "1,234.5". */
export function formatNumber(
  value: number | null | undefined,
  options: FormatNumberOptions = {},
): string {
  const { locale, missing = MISSING, ...intl } = options;
  if (!isPresent(value)) return missing;
  return formatter(locale, { signDisplay: "negative", ...intl }).format(value);
}

/**
 * Compact notation, an explicit choice: 1234 -> "1.2K", 2_500_000 -> "2.5M"
 * (suffixes are the locale's). One fraction digit unless overridden.
 */
export function formatCompact(
  value: number | null | undefined,
  options: Omit<FormatNumberOptions, "notation"> = {},
): string {
  return formatNumber(value, { maximumFractionDigits: fractionCap(1, options), ...options, notation: "compact" });
}

/**
 * A RATIO as a percentage: 0.123 -> "12.3%". Pass the ratio, not the percent
 * (the Intl convention); one fraction digit unless overridden.
 */
export function formatPercent(
  value: number | null | undefined,
  options: Omit<FormatNumberOptions, "style"> = {},
): string {
  return formatNumber(value, { maximumFractionDigits: fractionCap(1, options), ...options, style: "percent" });
}

/**
 * A value with a unit, named in Intl's sanctioned unit identifiers
 * (`"millisecond"`, `"megabyte"`, `"kilometer-per-hour"`): 120 -> "120 ms".
 * Short display unless overridden.
 */
export function formatUnit(
  value: number | null | undefined,
  unit: string,
  options: Omit<FormatNumberOptions, "style" | "unit"> = {},
): string {
  return formatNumber(value, { unitDisplay: "short", ...options, style: "unit", unit });
}

/**
 * A signed change, for trends and deltas: +12, −3, 0 (zero carries no sign).
 * Whether the change is GOOD is not this function's call: sentiment is keyed
 * by the caller (a falling error rate is good news).
 */
export function formatDelta(
  value: number | null | undefined,
  options: Omit<FormatNumberOptions, "signDisplay"> = {},
): string {
  return formatNumber(value, { ...options, signDisplay: "exceptZero" });
}

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"] as const;

/**
 * A byte count in the largest unit that keeps the number >= 1, base 1024:
 * 1536 -> "1.5 kB". One fraction digit unless overridden; whole bytes have none.
 */
export function formatBytes(
  bytes: number | null | undefined,
  options: Omit<FormatNumberOptions, "style" | "unit"> = {},
): string {
  if (!isPresent(bytes)) return options.missing ?? MISSING;
  const { maximumFractionDigits, maximumSignificantDigits } = options;
  const digitsFor = (unit: number) => maximumFractionDigits ?? fractionCap(unit === 0 ? 0 : 1, options);
  // The number as it will print, so the unit steps up on the rounded value:
  // 1,048,575 bytes is 1023.999 kB, which would otherwise print "1,024 kB".
  const shown = (n: number, unit: number) =>
    Number(
      formatter("en-US", {
        useGrouping: false,
        maximumFractionDigits: digitsFor(unit),
        ...(maximumSignificantDigits !== undefined && { maximumSignificantDigits }),
      }).format(n),
    );
  let unit = 0;
  let n = Math.abs(bytes);
  while (unit < BYTE_UNITS.length - 1 && (n >= 1024 || shown(n, unit) >= 1024)) {
    n /= 1024;
    unit += 1;
  }
  const signed = Math.sign(bytes) * n;
  return formatUnit(signed, BYTE_UNITS[unit] ?? "byte", { ...options, maximumFractionDigits: digitsFor(unit) });
}

// ── Dates ───────────────────────────────────────────────────────────────────

/** BCP 47 locale(s) as Intl takes them. Omitted: the runtime default. */
export type Locales = string | readonly string[] | undefined;

/** Distinct locale + option sets kept before the caches start over (bounds memory, not hits). */
const INTL_CACHE_MAX = 128;

function cached<F>(cache: Map<string, F>, key: string, make: () => F): F {
  let f = cache.get(key);
  if (!f) {
    if (cache.size >= INTL_CACHE_MAX) cache.clear();
    f = make();
    cache.set(key, f);
  }
  return f;
}

/** Builds with `locale`, else (a malformed tag throws) with the runtime default. */
function withLocaleFallback<F>(locale: Locales, make: (locale: string[] | undefined) => F): F {
  const tags = locale === undefined ? undefined : typeof locale === "string" ? [locale] : [...locale];
  try {
    return make(tags);
  } catch (error) {
    if (tags === undefined) throw error;
    return make(undefined);
  }
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();
const listFormats = new Map<string, Intl.ListFormat>();

/**
 * One shared `Intl.DateTimeFormat` per locale + options: building one costs far
 * more than formatting with it, and a chart axis or a timeline formats hundreds
 * of dates per render. A malformed locale falls back to the runtime default
 * instead of throwing mid-render; bad OPTIONS (an unknown `timeZone`) still throw.
 */
export function dateTimeFormatter(locale: Locales, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  return cached(dateTimeFormats, JSON.stringify([locale ?? null, options]), () =>
    withLocaleFallback(locale, (tags) => new Intl.DateTimeFormat(tags, options)),
  );
}

/** `dateTimeFormatter`'s counterpart for `Intl.RelativeTimeFormat` ("3 days ago"). */
export function relativeTimeFormatter(
  locale: Locales,
  options: Intl.RelativeTimeFormatOptions = {},
): Intl.RelativeTimeFormat {
  return cached(relativeTimeFormats, JSON.stringify([locale ?? null, options]), () =>
    withLocaleFallback(locale, (tags) => new Intl.RelativeTimeFormat(tags, options)),
  );
}

/** `dateTimeFormatter`'s counterpart for `Intl.ListFormat` ("A, B and C"). */
export function listFormatter(locale: Locales, options: Intl.ListFormatOptions = {}): Intl.ListFormat {
  return cached(listFormats, JSON.stringify([locale ?? null, options]), () =>
    withLocaleFallback(locale, (tags) => new Intl.ListFormat(tags, options)),
  );
}
