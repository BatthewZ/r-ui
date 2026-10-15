/**
 * Calendar-date arithmetic, formatting and parsing for the dates group, on `Date`
 * and `Intl` only.
 *
 * Time-zone stance: a value here is a CALENDAR DATE, not an instant. It is carried
 * as a `Date` at local midnight and only ever read through the local getters
 * (`getFullYear`, `getMonth`, `getDate`), so "15 October" stays 15 October in every
 * time zone the user's machine is set to. A `Date` passed in with a time of day is
 * read as the local day it falls on. Nothing here calls `toISOString()` or a UTC
 * getter: those move a local midnight to the previous day west of Greenwich. The
 * wire format is `YYYY-MM-DD` (`toISODate`).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A date range. `end` is `null` while the second endpoint is being chosen. */
export interface DateRange {
  start: Date | null;
  end: Date | null;
}

/**
 * A local calendar date, or `null` when the fields do not name one (month 13,
 * 31 April). `setFullYear` because `new Date(y, …)` reads a year below 100 as 19yy.
 */
export function makeDate(year: number, monthIndex: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return null;
  if (year < 1 || year > 9999 || monthIndex < 0 || monthIndex > 11 || day < 1) return null;
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  return date.getMonth() === monthIndex ? date : null;
}

/** Local midnight of `d`'s calendar day. */
export function startOfDay(d: Date): Date {
  const out = new Date(d.getTime());
  out.setHours(0, 0, 0, 0);
  return out;
}

export function startOfMonth(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(1);
  return out;
}

/** `d`'s calendar day shifted by `n` days (local midnight; DST-safe because it steps the day field). */
export function addDays(d: Date, n: number): Date {
  const out = startOfDay(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Shifted by `n` months, the day clamped to the target month (31 Jan + 1 → 28/29 Feb). */
export function addMonths(d: Date, n: number): Date {
  const out = startOfMonth(d);
  out.setMonth(out.getMonth() + n);
  const last = new Date(out.getTime());
  last.setMonth(last.getMonth() + 1, 0);
  out.setDate(Math.min(d.getDate(), last.getDate()));
  return out;
}

/** A sortable number for `d`'s calendar day (yyyymmdd), so comparisons ignore time. */
export function dayNumber(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Months since year 0: a total order over (year, month). */
export function monthNumber(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return a == b;
  return dayNumber(a) === dayNumber(b);
}

export function isSameRange(a: DateRange, b: DateRange): boolean {
  return isSameDay(a.start, b.start) && isSameDay(a.end, b.end);
}

/** Whether `d` lies outside `[min, max]` (by calendar day; either bound optional). */
export function isOutOfBounds(d: Date, min?: Date | null, max?: Date | null): boolean {
  const n = dayNumber(d);
  return (min != null && n < dayNumber(min)) || (max != null && n > dayNumber(max));
}

export function clampDay(d: Date, min?: Date | null, max?: Date | null): Date {
  if (min && dayNumber(d) < dayNumber(min)) return startOfDay(min);
  if (max && dayNumber(d) > dayNumber(max)) return startOfDay(max);
  return startOfDay(d);
}

/** `YYYY-MM-DD` of the local calendar day: the wire format, and a stable key. */
export function toISODate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ISO_DATE = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/;

/** The local calendar date an ISO `YYYY-MM-DD` names, or `null`. */
export function parseISODate(text: string): Date | null {
  const m = ISO_DATE.exec(text);
  return m ? makeDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// ── Intl ────────────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * One `Intl.DateTimeFormat` per locale and option set. Building one costs far
 * more than formatting with it, and a month grid names 42 days per render.
 */
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    if (formatters.size > 64) formatters.clear();
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** The caller's locale, else the runtime's default. */
export function resolveLocale(locale: string | undefined): string {
  return locale ?? new Intl.DateTimeFormat().resolvedOptions().locale;
}

/**
 * Regions whose week starts on Sunday or Saturday (CLDR `firstDay`); every other
 * region starts on Monday. The fallback for engines without `Intl.Locale` week info.
 */
const SUNDAY_FIRST = new Set(
  "AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(" "),
);
const SATURDAY_FIRST = new Set("AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" "));

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
}

/** The first day of the week for `locale` (0 = Sunday), from `Intl.Locale` where the engine has it. */
export function weekStartFor(locale: string): Weekday {
  try {
    const loc = new Intl.Locale(locale);
    const info = (loc as unknown as WeekInfoLocale).getWeekInfo?.() ?? (loc as unknown as WeekInfoLocale).weekInfo;
    // Intl numbers days 1 (Monday) … 7 (Sunday).
    if (info && info.firstDay >= 1 && info.firstDay <= 7) return (info.firstDay % 7) as Weekday;
    const region = loc.maximize().region ?? "";
    if (SUNDAY_FIRST.has(region)) return 0;
    if (SATURDAY_FIRST.has(region)) return 6;
  } catch {
    /* an unknown tag: Monday, the CLDR default */
  }
  return 1;
}

/** 4 Jan 2026 is a Sunday: day `i` of that week is weekday `i`. */
const SUNDAY = new Date(2026, 0, 4);

export interface WeekdayName {
  /** The column header: short where the locale's short names are short, else narrow. */
  short: string;
  long: string;
}

/** The seven weekday names from `weekStart`. */
export function weekdayNames(locale: string, weekStart: Weekday): WeekdayName[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(SUNDAY, (weekStart + i) % 7));
  const short = days.map((d) => dateFormatter(locale, { weekday: "short" }).format(d));
  // A header column is one day cell wide; "الأحد" is not, "S" always is.
  const useShort = short.every((s) => [...s].length <= 3);
  return days.map((d, i) => ({
    short: useShort ? (short[i] ?? "") : dateFormatter(locale, { weekday: "narrow" }).format(d),
    long: dateFormatter(locale, { weekday: "long" }).format(d),
  }));
}

/** "October 2026", in the locale's own order. */
export function monthLabel(month: Date, locale: string): string {
  return dateFormatter(locale, { month: "long", year: "numeric" }).format(month);
}

/** "Thursday, October 15, 2026": a day button's accessible name. */
export function dayLabel(d: Date, locale: string): string {
  return dateFormatter(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(d);
}

/**
 * Six weeks of seven cells covering `month`, starting on `weekStart`. Days of the
 * neighbouring months are `null`: they render as blank padding, so a date is never
 * on screen (or focusable) twice when months sit side by side. Always six rows, so
 * the grid's height does not jump while paging.
 */
export function monthGrid(month: Date, weekStart: Weekday): (Date | null)[][] {
  const first = startOfMonth(month);
  const lead = (first.getDay() - weekStart + 7) % 7;
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => {
      const d = addDays(first, row * 7 + col - lead);
      return d.getMonth() === first.getMonth() ? d : null;
    }),
  );
}

// ── Typed entry ─────────────────────────────────────────────────────────────

const NUMERIC: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

/** The committed value as the field shows it: all-numeric in the locale's order ("10/15/2026", "15.10.2026"). */
export function formatInputDate(d: Date, locale: string): string {
  return dateFormatter(locale, NUMERIC).format(d);
}

type Field = "day" | "month" | "year";

/** The order the locale writes day, month and year in. */
function fieldOrder(locale: string): Field[] {
  return dateFormatter(locale, NUMERIC)
    .formatToParts(new Date(2026, 11, 22))
    .map((p) => p.type)
    .filter((t): t is Field => t === "day" || t === "month" || t === "year");
}

export interface FormatLetters {
  day: string;
  month: string;
  year: string;
}

export const DEFAULT_FORMAT_LETTERS: FormatLetters = { day: "DD", month: "MM", year: "YYYY" };

/**
 * The pattern the field accepts and shows, for the visible hint: "MM/DD/YYYY" in
 * en-US, "DD.MM.YYYY" in de-DE. Separators come from the locale; the letters are
 * a label (German readers expect "TT.MM.JJJJ"), so the caller can translate them.
 */
export function formatPattern(locale: string, letters: FormatLetters = DEFAULT_FORMAT_LETTERS): string {
  return dateFormatter(locale, NUMERIC)
    .formatToParts(new Date(2026, 11, 22))
    .map((p) => (p.type === "day" || p.type === "month" || p.type === "year" ? letters[p.type] : p.value))
    .join("")
    .replace(/[‎‏]/g, "");
}

/** Lower case, no diacritics, letters and digits only: tolerant month-name matching. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function fullYear(raw: string): number {
  const n = Number(raw);
  // Two digits read as this century: "26" is 2026, the common case in typed entry.
  return raw.length <= 2 ? 2000 + n : n;
}

/** Digits in any script (Arabic-Indic, Devanagari…) as ASCII, so `\d` reads them. */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    // Every Unicode decimal-digit block is ten consecutive code points from zero.
    for (let zero = code; zero > code - 10; zero -= 1) {
      if (/\p{Nd}/u.test(String.fromCodePoint(zero - 1))) continue;
      return String(code - zero);
    }
    return ch;
  });
}

/**
 * The calendar date a user typed, read in `locale`'s field order, or `null`.
 *
 * Accepts: numbers with any separators in the locale's order ("10/15/2026" in
 * en-US, "15.10.2026" in de-DE, two-digit years as 20yy); ISO `2026-10-15` in any
 * locale (four leading digits cannot be a day or month); and a month name with a
 * day and year in any order ("15 Oct 2026", "October 15, 2026"), so a textual
 * format round-trips.
 */
export function parseDate(input: string, locale: string): Date | null {
  const text = asciiDigits(input.trim());
  if (text === "") return null;
  const iso = parseISODate(text);
  if (iso) return iso;

  const runs = text.match(/\d+/g) ?? [];
  const hasLetters = /\p{L}/u.test(text);
  if (runs.length === 3 && !hasLetters) {
    const order = fieldOrder(locale);
    const fields: Partial<Record<Field, string>> = {};
    order.forEach((field, i) => (fields[field] = runs[i]));
    if (!fields.day || !fields.month || !fields.year || fields.year.length === 3 || fields.year.length > 4) return null;
    if (fields.day.length > 2 || fields.month.length > 2) return null;
    return makeDate(fullYear(fields.year), Number(fields.month) - 1, Number(fields.day));
  }

  if (runs.length === 2 && hasLetters) {
    const haystack = fold(text);
    let monthIndex = -1;
    let longest = 0;
    for (const style of ["long", "short"] as const) {
      const format = dateFormatter(locale, { month: style });
      for (let m = 0; m < 12; m += 1) {
        const name = fold(format.format(new Date(2026, m, 1)));
        if (name.length > longest && haystack.includes(name)) {
          monthIndex = m;
          longest = name.length;
        }
      }
    }
    if (monthIndex < 0) return null;
    const [a = "", b = ""] = runs;
    // The year is the run that cannot be a day.
    const aIsYear = a.length >= 3 || Number(a) > 31;
    const [day, year] = aIsYear ? [b, a] : [a, b];
    if (day.length > 2) return null;
    return makeDate(fullYear(year), monthIndex, Number(day));
  }
  return null;
}
