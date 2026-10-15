/**
 * Scales, ticks and label fitting: the arithmetic every chart shares.
 *
 * Pure: no DOM, no React. A text measurement is a function the caller hands in
 * (a canvas in the browser, a character estimate in tests and on the server), so
 * everything here is decided, and tested, without a layout engine.
 *
 * Nothing here throws. A value that is not a finite number has no position; a
 * span too wide for a double is halved before it is divided; a domain that
 * cannot be made nice falls back to its own ends.
 */

import { dateTimeFormatter } from "../../util/format";

export const clamp = (value: number, lo: number, hi: number): number => Math.min(Math.max(value, lo), hi);

export const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Rounded to hundredths: SVG coordinates need no more, and paths stay short. */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Measures one line of axis text in px. */
export type Measure = (text: string) => number;

/** A width estimate from the font size alone: generous, so an estimate never under-spaces. */
export function estimateMeasure(fontSize: number): Measure {
  const per = (Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 12) * 0.62;
  return (text) => text.length * per;
}

/* ------------------------------------------------------------------ */
/*  Value scale                                                        */
/* ------------------------------------------------------------------ */

export interface NiceScale {
  lo: number;
  hi: number;
  ticks: number[];
}

/** The nearest 1/2/5 × 10ⁿ at or above `rough` (or at or below it, for a pinned domain). */
function niceStep(rough: number, down: boolean): number {
  const exponent = Math.floor(Math.log10(rough));
  const base = 10 ** exponent;
  const n = rough / base;
  const nice = down ? (n >= 5 ? 5 : n >= 2 ? 2 : 1) : n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

function stepDecimals(step: number): number {
  const exponent = Math.floor(Math.log10(step));
  return clamp(-exponent, 0, 20);
}

/**
 * A domain rounded out to 1/2/5 × 10ⁿ so every gridline is a number a reader
 * can name, with at most `maxCount` ticks. An end the caller pinned is kept
 * exactly and the step comes down to fit inside it. A zero span keeps its one
 * tick. Ticks are multiples of the step rather than an accumulation, so no
 * gridline reads 0.30000000000000004.
 */
export function niceTicks(low: number, high: number, maxCount = 5, pinLo = false, pinHi = false): NiceScale {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return { lo: 0, hi: 1, ticks: [0, 1] };
  const [min, max] = low <= high ? [low, high] : [high, low];
  if (min === max) return { lo: min, hi: max, ticks: [min] };
  const count = clamp(Math.floor(Number.isFinite(maxCount) ? maxCount : 5), 2, 24);
  const fallback = { lo: min, hi: max, ticks: [min, max] };

  // Halved before dividing: `1e308 - -1e308` is Infinity.
  const rough = ((max / 2 - min / 2) / (count - 1)) * 2;
  if (!Number.isFinite(rough) || rough <= 0) return fallback;
  const step = niceStep(rough, pinLo || pinHi);
  if (!Number.isFinite(step) || step <= 0) return fallback;

  const lo = pinLo ? min : Math.floor(min / step) * step;
  const hi = pinHi ? max : Math.ceil(max / step) * step;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return fallback;
  const first = Math.ceil(lo / step);
  const last = Math.floor(hi / step);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last - first > 48) return { lo, hi, ticks: [lo, hi] };

  const decimals = stepDecimals(step);
  const at = (v: number) => Number(v.toFixed(decimals));
  const ticks: number[] = [];
  if (pinLo) ticks.push(lo);
  for (let i = first; i <= last; i += 1) {
    const v = at(i * step);
    if (v >= lo && v <= hi && v !== ticks[ticks.length - 1]) ticks.push(v);
  }
  if (pinHi && ticks[ticks.length - 1] !== hi) ticks.push(hi);
  // A pinned end can sit a hair from a multiple; two labels on one line is noise.
  const minGap = step / 3;
  const spaced = ticks.filter((v, i) => {
    if (i === 0) return true;
    const prev = ticks[i - 1] ?? v;
    const isPinned = (pinLo && v === lo) || (pinHi && v === hi);
    if (isPinned) return true;
    // A multiple a hair below a pinned top gives way to it, as one above a pinned bottom does.
    const crowdsTop = pinHi && i === ticks.length - 2 && hi - v < minGap;
    return v - prev >= minGap && !crowdsTop;
  });
  return { lo, hi, ticks: spaced };
}

/**
 * `hi - lo`, halved when the plain difference overflows a double
 * (`1e308 - -1e308` is Infinity). A value measured against `span` is scaled by
 * the same `scale` first: `(value * scale - lo * scale) / span`.
 */
export function safeSpan(lo: number, hi: number): { scale: number; span: number } {
  const scale = Number.isFinite(hi - lo) ? 1 : 0.5;
  return { scale, span: hi * scale - lo * scale };
}

/**
 * Value to pixel, or `null` where there is no pixel to give. Values outside the
 * domain clamp to its edge (the table still carries the real value). A zero span
 * projects to the middle.
 */
export function linearScale(lo: number, hi: number, from: number, to: number): (value: number | null | undefined) => number | null {
  const { scale, span } = safeSpan(lo, hi);
  return (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const t = span === 0 ? 0.5 : (value * scale - lo * scale) / span;
    if (!Number.isFinite(t)) return null;
    return from + clamp(t, 0, 1) * (to - from);
  };
}

/* ------------------------------------------------------------------ */
/*  Label fitting                                                      */
/* ------------------------------------------------------------------ */

export interface AxisLabel {
  /** The tick's position along the axis (px). */
  at: number;
  /** Where the label's centre is drawn: `at`, pulled inside the bounds at the ends. */
  center: number;
  text: string;
  width: number;
}

/**
 * Places labels centred on their ticks, pulled in at the ends so none leaves
 * `[start, end]`, and returns them only if no two come closer than `gap`.
 */
export function fitLabels(
  ticks: readonly { at: number; text: string }[],
  measure: Measure,
  start: number,
  end: number,
  gap: number,
): AxisLabel[] | null {
  const placed: AxisLabel[] = [];
  for (const tick of ticks) {
    const width = measure(tick.text);
    const half = width / 2;
    const center = end - start >= width ? clamp(tick.at, start + half, end - half) : (start + end) / 2;
    const prev = placed[placed.length - 1];
    if (prev && center - half - (prev.center + prev.width / 2) < gap) return null;
    placed.push({ at: tick.at, center, text: tick.text, width });
  }
  return placed;
}

/**
 * The densest every-k-th subset of `ticks` whose labels fit, anchored at the
 * last tick (the most recent point is the one a dashboard reader looks for) or
 * at the first. Always returns at least one label when there is a tick.
 */
export function thinLabels(
  ticks: readonly { at: number; text: string }[],
  measure: Measure,
  start: number,
  end: number,
  gap: number,
  anchor: "first" | "last" = "last",
): AxisLabel[] {
  const n = ticks.length;
  const at = (k: number) =>
    fitLabels(
      ticks.filter((_, i) => (anchor === "last" ? n - 1 - i : i) % k === 0),
      measure,
      start,
      end,
      gap,
    );
  for (let k = 1; k <= n; k += 1) {
    const placed = at(k);
    if (!placed) continue;
    // A stride that divides the count reads as a rhythm (every 6th of 24 hours,
    // not every 5th): take one if it is at most twice as sparse.
    for (let nice = k; nice <= Math.min(n, k * 2) && n % k !== 0; nice += 1) {
      if (n % nice !== 0) continue;
      const even = at(nice);
      if (even) return even;
    }
    return placed;
  }
  const one = anchor === "last" ? ticks[n - 1] : ticks[0];
  if (!one) return [];
  const width = measure(one.text);
  return [{ at: one.at, center: clamp(one.at, start + width / 2, Math.max(start + width / 2, end - width / 2)), text: one.text, width }];
}

/* ------------------------------------------------------------------ */
/*  Time                                                               */
/* ------------------------------------------------------------------ */

export type TimeZoneMode = "local" | "UTC";
export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

export interface TimeInterval {
  unit: TimeUnit;
  step: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNIT_MS: Record<TimeUnit, number> = {
  second: SECOND,
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  week: 7 * DAY,
  month: 30.44 * DAY,
  year: 365.25 * DAY,
};

/**
 * The calendar ladder, finest first. Each step divides the next unit evenly (a
 * 3-hour tick lands on midnight; a 3-month tick on January), so labels sit on
 * boundaries a reader already counts in. Years past the ladder take a 1/2/5 step.
 */
export const TIME_LADDER: readonly TimeInterval[] = [
  { unit: "second", step: 1 },
  { unit: "second", step: 5 },
  { unit: "second", step: 15 },
  { unit: "second", step: 30 },
  { unit: "minute", step: 1 },
  { unit: "minute", step: 5 },
  { unit: "minute", step: 15 },
  { unit: "minute", step: 30 },
  { unit: "hour", step: 1 },
  { unit: "hour", step: 3 },
  { unit: "hour", step: 6 },
  { unit: "hour", step: 12 },
  { unit: "day", step: 1 },
  { unit: "day", step: 2 },
  { unit: "week", step: 1 },
  { unit: "month", step: 1 },
  { unit: "month", step: 3 },
  { unit: "month", step: 6 },
  { unit: "year", step: 1 },
];

export const intervalMs = (interval: TimeInterval): number => UNIT_MS[interval.unit] * interval.step;

interface Fields {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  dow: number;
}

function fieldsOf(t: number, zone: TimeZoneMode): Fields {
  const date = new Date(t);
  return zone === "UTC"
    ? {
        y: date.getUTCFullYear(),
        mo: date.getUTCMonth(),
        d: date.getUTCDate(),
        h: date.getUTCHours(),
        mi: date.getUTCMinutes(),
        s: date.getUTCSeconds(),
        dow: date.getUTCDay(),
      }
    : {
        y: date.getFullYear(),
        mo: date.getMonth(),
        d: date.getDate(),
        h: date.getHours(),
        mi: date.getMinutes(),
        s: date.getSeconds(),
        dow: date.getDay(),
      };
}

function make(f: Omit<Fields, "dow">, zone: TimeZoneMode): number {
  const date = new Date(0);
  if (zone === "UTC") {
    date.setUTCFullYear(f.y, f.mo, f.d);
    date.setUTCHours(f.h, f.mi, f.s, 0);
  } else {
    date.setFullYear(f.y, f.mo, f.d);
    date.setHours(f.h, f.mi, f.s, 0);
  }
  return date.getTime();
}

/** `t` rounded down to the start of its interval, in the zone's calendar. */
function floorTo(t: number, { unit, step }: TimeInterval, zone: TimeZoneMode): number {
  const f = fieldsOf(t, zone);
  const down = (v: number, base = 0) => Math.floor((v - base) / step) * step + base;
  switch (unit) {
    case "second":
      return make({ ...f, s: down(f.s) }, zone);
    case "minute":
      return make({ ...f, mi: down(f.mi), s: 0 }, zone);
    case "hour":
      return make({ ...f, h: down(f.h), mi: 0, s: 0 }, zone);
    case "day":
      return make({ ...f, d: down(f.d, 1), h: 0, mi: 0, s: 0 }, zone);
    case "week":
      // Weeks start on Monday (ISO 8601).
      return make({ ...f, d: f.d - ((f.dow + 6) % 7), h: 0, mi: 0, s: 0 }, zone);
    case "month":
      return make({ ...f, mo: down(f.mo), d: 1, h: 0, mi: 0, s: 0 }, zone);
    case "year":
      return make({ y: down(f.y), mo: 0, d: 1, h: 0, mi: 0, s: 0 }, zone);
  }
}

function advance(t: number, { unit, step }: TimeInterval, zone: TimeZoneMode): number {
  const f = fieldsOf(t, zone);
  switch (unit) {
    case "second":
      return make({ ...f, s: f.s + step }, zone);
    case "minute":
      return make({ ...f, mi: f.mi + step }, zone);
    case "hour":
      return make({ ...f, h: f.h + step }, zone);
    case "day": {
      const next = make({ ...f, d: f.d + step }, zone);
      // A 2-day step restarts on the 1st, as `floorTo` counts from it.
      return step > 1 && fieldsOf(next, zone).mo !== f.mo ? make({ ...f, mo: f.mo + 1, d: 1 }, zone) : next;
    }
    case "week":
      return make({ ...f, d: f.d + 7 * step }, zone);
    case "month":
      return make({ ...f, mo: f.mo + step }, zone);
    case "year":
      return make({ ...f, y: f.y + step }, zone);
  }
}

/** Ticks on `interval` boundaries inside `[t0, t1]`, at most `limit` of them. */
export function timeTicksAt(t0: number, t1: number, interval: TimeInterval, zone: TimeZoneMode, limit = 400): number[] {
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return [];
  const out: number[] = [];
  let t = floorTo(t0, interval, zone);
  for (let guard = 0; guard < limit * 2 && t <= t1 && Number.isFinite(t); guard += 1) {
    if (t >= t0 && (out.length === 0 || t > (out[out.length - 1] ?? -Infinity))) out.push(t);
    if (out.length > limit) return out;
    const next = advance(t, interval, zone);
    // A DST gap can make local arithmetic stand still; never loop on it.
    t = next > t ? next : t + intervalMs(interval);
  }
  return out;
}

/** Whether `t` sits exactly on a boundary of `interval`. */
export function isOnBoundary(t: number, interval: TimeInterval, zone: TimeZoneMode): boolean {
  return Number.isFinite(t) && floorTo(t, interval, zone) === t;
}

function dateFormat(locale: string | undefined, zone: TimeZoneMode, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return dateTimeFormatter(locale, zone === "UTC" ? { ...options, timeZone: "UTC" } : options);
}

const safeDate = (t: number, f: Intl.DateTimeFormat): string => {
  try {
    return f.format(t);
  } catch {
    return "—";
  }
};

/**
 * A tick's label at a given interval, two-level: a sub-day tick that lands on
 * midnight names the day instead of the time, and a month tick on January names
 * the year, so a reader always knows which day or year the hours belong to.
 */
export function timeTickLabel(t: number, interval: TimeInterval, zone: TimeZoneMode, locale?: string): string {
  const f = fieldsOf(t, zone);
  const { unit } = interval;
  if (unit === "second") return safeDate(t, dateFormat(locale, zone, { hour: "numeric", minute: "2-digit", second: "2-digit" }));
  if ((unit === "minute" || unit === "hour") && !(f.h === 0 && f.mi === 0)) {
    return safeDate(t, dateFormat(locale, zone, { hour: "numeric", minute: "2-digit" }));
  }
  if (unit === "month" && f.mo !== 0) return safeDate(t, dateFormat(locale, zone, { month: "short" }));
  if (unit === "month" || unit === "year") return safeDate(t, dateFormat(locale, zone, { year: "numeric" }));
  return safeDate(t, dateFormat(locale, zone, { month: "short", day: "numeric" }));
}

/** The full label of one data point's time, for a tooltip or a table row. */
export function timePointLabel(t: number, dataStep: number | null, zone: TimeZoneMode, locale?: string): string {
  const withTime = dataStep === null || dataStep < DAY;
  return safeDate(
    t,
    dateFormat(
      locale,
      zone,
      withTime
        ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
        : { weekday: "short", month: "short", day: "numeric", year: "numeric" },
    ),
  );
}

/** Year ticks past the ladder: a 1/2/5 × 10ⁿ step in whole years. */
function yearInterval(t0: number, t1: number, maxCount: number): TimeInterval {
  const years = (t1 - t0) / UNIT_MS.year;
  const rough = Math.max(1, years / Math.max(1, maxCount - 1));
  const step = niceStep(rough, false);
  return { unit: "year", step: Number.isFinite(step) && step >= 1 ? Math.min(step, 1e5) : 1 };
}

export interface TimeAxis {
  interval: TimeInterval | null;
  labels: AxisLabel[];
}

/**
 * Time ticks for `[t0, t1]` drawn across `[start, end]` px: the finest rung of
 * the ladder whose labels all fit without overlapping. Too narrow for even one
 * rung, it labels nothing (the tooltip and the table still carry every time).
 */
export function timeAxis(
  t0: number,
  t1: number,
  project: (t: number) => number | null,
  measure: Measure,
  start: number,
  end: number,
  gap: number,
  zone: TimeZoneMode,
  locale?: string,
): TimeAxis {
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return { interval: null, labels: [] };
  const span = t1 - t0;
  const room = Math.max(1, end - start);
  // No label is narrower than this, so no rung needs more ticks than fit at this width.
  const narrowest = measure("00:00") + gap;
  const maxCount = Math.max(1, Math.floor(room / Math.max(1, narrowest)));
  const rungs = [...TIME_LADDER, yearInterval(t0, t1, maxCount)];
  for (const interval of rungs) {
    if (span / intervalMs(interval) > maxCount) continue;
    const ticks = timeTicksAt(t0, t1, interval, zone, maxCount + 2)
      .map((t) => ({ at: project(t), text: timeTickLabel(t, interval, zone, locale) }))
      .filter((tick): tick is { at: number; text: string } => tick.at !== null);
    if (ticks.length === 0) continue;
    const placed = fitLabels(ticks, measure, start, end, gap);
    if (placed) return { interval, labels: placed };
  }
  return { interval: null, labels: [] };
}

/**
 * Labels for a band (bar) axis whose categories are times: only bands that start
 * a calendar boundary are labelled, on the finest rung where those labels fit.
 * Irregular times with no boundary fall back to plain thinning.
 */
export function bandTimeLabels(
  times: readonly (number | null)[],
  centers: readonly number[],
  measure: Measure,
  start: number,
  end: number,
  gap: number,
  zone: TimeZoneMode,
  locale?: string,
): AxisLabel[] | null {
  for (const interval of TIME_LADDER) {
    const ticks: { at: number; text: string }[] = [];
    times.forEach((t, i) => {
      const at = centers[i];
      if (t === null || at === undefined || !isOnBoundary(t, interval, zone)) return;
      ticks.push({ at, text: timeTickLabel(t, interval, zone, locale) });
    });
    if (ticks.length < 2) continue;
    const placed = fitLabels(ticks, measure, start, end, gap);
    if (placed) return placed;
  }
  return null;
}
