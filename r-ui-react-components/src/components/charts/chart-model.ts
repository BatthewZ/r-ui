/**
 * The data half of every chart: caller input normalised into one model that the
 * drawing, the tooltip, the legend and the table all read.
 *
 * Pure and total. Input arrives as whatever the caller (often an API) produced,
 * so every field is checked rather than trusted: a value that is not a finite
 * number is a gap, a name that is not a string is "Series N", a duplicate name is
 * numbered, a 20,000-character label is cut, and every collection is sliced to
 * its cap BEFORE any value is read, so the work is bounded by the caps rather
 * than by the input. What a cap removes is counted, so the chart can say so.
 */
import { formatNumber, formatUnit, MISSING } from "../../util/format";
import type { SeriesSlot } from "../data";
import { finiteOrNull, timePointLabel, type TimeZoneMode } from "./chart-scale";

/** Points (rows) drawn and tabulated per chart. Past it, the rest is counted and noted. */
export const MAX_ROWS = 1000;
/** Series drawn: one per series ink, never cycled. The table carries more. */
export const MAX_DRAWN_SERIES = 8;
/** Series tabulated. Past it, the rest is counted and noted. */
export const MAX_TABLE_SERIES = 24;
/** A label (series name, category, row) is cut here, with an ellipsis. */
export const MAX_LABEL_CHARS = 80;
/** An axis label is cut shorter: it shares a line with its neighbours. */
export const MAX_AXIS_CHARS = 18;

export type { SeriesSlot };

/** One mark shape per series slot: identity never rests on colour alone. */
export type SeriesShape = "circle" | "square" | "triangle" | "diamond" | "triangle-down" | "plus" | "cross" | "star";
export const SERIES_SHAPES: readonly SeriesShape[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "triangle-down",
  "plus",
  "cross",
  "star",
];

export interface ChartSeries {
  /** Shown in the legend, the tooltip and the table's column header. */
  name: string;
  /** One value per x, in the same order. `null` is a gap (no data), never a zero. */
  values: readonly (number | null | undefined)[];
  /**
   * The entity's series slot (colour and shape), fixed per entity so a filter that
   * drops other series never repaints this one. Unpinned series take the free
   * slots in order; a slot already taken is ignored.
   */
  slot?: SeriesSlot;
}

export type ChartX = string | number | Date;
export type XScaleType = "category" | "number" | "time";

/** One line of whitespace, then a hard cap: an SVG draws a newline as a space anyway. */
export function tidyLabel(value: unknown, limit = MAX_LABEL_CHARS): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}…` : text;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

export interface ValueFormatOptions {
  /**
   * An Intl unit identifier (`"millisecond"`, `"megabyte-per-second"`, `"percent"`)
   * formatted by `Intl`; any other text (`"req/s"`) is appended after the number.
   */
  unit?: string;
  /** Formats every value (tooltip, table, summary). Wins over `unit`. */
  format?: (value: number) => string;
  /** Formats the value axis's ticks. Default: compact (`1.2K`), with the unit. */
  formatTick?: (value: number) => string;
  /** BCP 47 locale for every number and date. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
}

const intlUnits = new Map<string, boolean>();
function isIntlUnit(unit: string): boolean {
  let ok = intlUnits.get(unit);
  if (ok === undefined) {
    try {
      new Intl.NumberFormat("en", { style: "unit", unit });
      ok = true;
    } catch {
      ok = false;
    }
    intlUnits.set(unit, ok);
  }
  return ok;
}

/** Past this, compact notation runs out of suffixes ("1000T"), so scientific it is. */
const HUGE = 1e15;

function plainNumber(value: number, options: { compact: boolean; unit?: string; locale?: string }): string {
  const { compact, unit, locale } = options;
  const magnitude = Math.abs(value);
  const scientific = magnitude >= HUGE || (magnitude > 0 && magnitude < 1e-6);
  const intl = {
    locale,
    ...(scientific
      ? { notation: "scientific" as const, maximumSignificantDigits: 3 }
      : compact
        ? { notation: "compact" as const, maximumFractionDigits: 1 }
        : { maximumFractionDigits: magnitude < 1 ? 4 : 2 }),
  };
  if (unit && isIntlUnit(unit)) return formatUnit(value, unit, intl);
  const text = formatNumber(value, intl);
  return unit ? `${text} ${tidyLabel(unit, 16)}` : text;
}

/** Calls a caller's formatter without letting it throw or return a novel. */
function guarded(fn: ((value: number) => string) | undefined, fallback: (value: number) => string) {
  if (typeof fn !== "function") return fallback;
  return (value: number) => {
    try {
      const out = fn(value);
      return typeof out === "string" && out.length > 0 ? tidyLabel(out, MAX_AXIS_CHARS * 2) : fallback(value);
    } catch {
      return fallback(value);
    }
  };
}

export interface Formatters {
  /** A value in the tooltip, the table and the summary; `MISSING` for a gap. */
  value: (value: number | null) => string;
  /** A value-axis tick. */
  tick: (value: number) => string;
}

export function makeFormatters({ unit, format, formatTick, locale }: ValueFormatOptions): Formatters {
  const safeUnit = typeof unit === "string" && unit.trim() ? unit.trim() : undefined;
  const value = guarded(format, (v) => plainNumber(v, { compact: false, unit: safeUnit, locale }));
  const tick = guarded(formatTick, (v) => tidyLabel(plainNumber(v, { compact: true, unit: safeUnit, locale }), MAX_AXIS_CHARS));
  return {
    value: (v) => (v === null || !Number.isFinite(v) ? MISSING : value(v)),
    tick,
  };
}

/* ------------------------------------------------------------------ */
/*  Cartesian model (line, area, bar)                                  */
/* ------------------------------------------------------------------ */

export interface ModelSeries {
  /** Position in the caller's array. */
  index: number;
  name: string;
  /** The ink, or `null` past the eighth series (tabulated, not drawn). */
  slot: SeriesSlot | null;
  shape: SeriesShape | null;
}

/** A series that is drawn: it has an ink and a shape. */
export type DrawnSeries = ModelSeries & { slot: SeriesSlot; shape: SeriesShape };

export function drawnSeries(series: readonly ModelSeries[]): DrawnSeries[] {
  return series.filter((s): s is DrawnSeries => s.slot !== null && s.shape !== null);
}

export interface ModelRow {
  /** Position in the caller's `x`. */
  index: number;
  /** Position on a number or time axis (ms for time); the index for a category. `null`: cannot be placed. */
  x: number | null;
  /** The row's full label, for the tooltip title and the table's row header. */
  label: string;
  /** The axis label (shorter). */
  axisLabel: string;
  /** One per tabulated series, in series order. */
  values: (number | null)[];
}

export interface CartesianModel {
  xType: XScaleType;
  zone: TimeZoneMode;
  locale?: string;
  /** Drawable rows first, sorted by x (number, time); then rows that cannot be placed. */
  rows: ModelRow[];
  series: ModelSeries[];
  /** The smallest step between neighbouring x values (number, time), or `null`. */
  xStep: number | null;
  /** What the caps (and mismatched lengths) left out. */
  dropped: { rows: number; series: number; values: number };
  /** Whether at least one value can be drawn. */
  drawable: boolean;
  /** Formats a number-axis x value (its ticks and row labels). */
  formatX: (value: number) => string;
}

export interface CartesianInput {
  x?: readonly ChartX[] | null;
  series?: readonly ChartSeries[] | null;
  xType?: XScaleType;
  timeZone?: TimeZoneMode;
  locale?: string;
  /** Formats a number-axis x value (row label). */
  formatX?: (value: number) => string;
}

function inferXType(x: readonly unknown[]): XScaleType {
  const present = x.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return "category";
  if (present.every((v) => v instanceof Date)) return "time";
  if (present.every((v) => typeof v === "number")) return "number";
  return "category";
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function timeOf(value: unknown, zone: TimeZoneMode): number | null {
  if (value instanceof Date) return finiteOrNull(value.getTime());
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? value : null;
  if (typeof value === "string") {
    // A bare `YYYY-MM-DD` is a calendar date. `Date.parse` reads it as UTC midnight (the
    // previous day west of Greenwich); with a time and no offset it reads local time.
    const text = value.trim();
    return finiteOrNull(Date.parse(zone === "local" && DATE_ONLY.test(text) ? `${text}T00:00` : value));
  }
  return null;
}

/** Duplicate names get " (2)", " (3)": a table with two identical column headers is ambiguous. */
function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}

/**
 * Each series' slot: a valid pin first (an entity keeps its colour; a slot
 * already taken is ignored), then the free slots in order. `null` past the last.
 */
function assignSlots(requested: readonly unknown[]): (SeriesSlot | null)[] {
  const taken = new Set<number>();
  const pinned = requested.map((slot) => {
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 1 || slot > MAX_DRAWN_SERIES || taken.has(slot)) return null;
    taken.add(slot);
    return slot as SeriesSlot;
  });
  let next = 1;
  return pinned.map((slot) => {
    if (slot !== null) return slot;
    while (taken.has(next)) next += 1;
    if (next > MAX_DRAWN_SERIES) return null;
    taken.add(next);
    return next as SeriesSlot;
  });
}

export function modelCartesian(input: CartesianInput): CartesianModel {
  const zone: TimeZoneMode = input.timeZone === "UTC" ? "UTC" : "local";
  const locale = typeof input.locale === "string" ? input.locale : undefined;
  const suppliedSeries: readonly unknown[] = Array.isArray(input.series) ? input.series : [];
  const suppliedX: readonly unknown[] = Array.isArray(input.x) ? input.x : [];
  const xType: XScaleType =
    input.xType === "category" || input.xType === "number" || input.xType === "time"
      ? input.xType
      : inferXType(suppliedX.slice(0, MAX_ROWS));

  const tabulated = suppliedSeries.slice(0, MAX_TABLE_SERIES).map((entry, index) => {
    const series = (entry !== null && typeof entry === "object" ? entry : {}) as Partial<ChartSeries>;
    const values: readonly unknown[] = Array.isArray(series.values) ? series.values : [];
    return { name: tidyLabel(series.name) || `Series ${index + 1}`, values, slot: series.slot };
  });
  const names = uniqueNames(tabulated.map((s) => s.name));

  const longest = tabulated.reduce((most, s) => Math.max(most, s.values.length), 0);
  const total = suppliedX.length > 0 ? suppliedX.length : longest;
  const count = Math.min(total, MAX_ROWS);
  const values = tabulated.map((s) => s.values.slice(0, count).map(finiteOrNull));
  const extraValues = suppliedX.length > 0 ? tabulated.reduce((n, s) => n + Math.max(0, s.values.length - suppliedX.length), 0) : 0;

  const formatX = guarded(input.formatX, (v) => plainNumber(v, { compact: false, locale }));
  const rows: ModelRow[] = Array.from({ length: count }, (_, index) => {
    const raw = suppliedX[index];
    let x: number | null;
    let label: string;
    let axisLabel: string;
    if (xType === "time") {
      x = timeOf(raw, zone);
      label = x === null ? MISSING : timePointLabel(x, null, zone, locale);
      axisLabel = label;
    } else if (xType === "number") {
      x = finiteOrNull(raw);
      label = x === null ? MISSING : formatX(x);
      axisLabel = tidyLabel(label, MAX_AXIS_CHARS);
    } else {
      x = index;
      const text = raw instanceof Date ? timePointLabel(timeOf(raw, zone) ?? Number.NaN, null, zone, locale) : typeof raw === "number" ? String(raw) : raw;
      label = tidyLabel(text) || String(index + 1);
      axisLabel = tidyLabel(label, MAX_AXIS_CHARS);
    }
    return { index, x, label, axisLabel, values: values.map((v) => v[index] ?? null) };
  });

  if (xType !== "category") {
    const placed = rows.filter((r) => r.x !== null).sort((a, b) => (a.x ?? 0) - (b.x ?? 0) || a.index - b.index);
    const unplaced = rows.filter((r) => r.x === null);
    rows.splice(0, rows.length, ...placed, ...unplaced);
  }

  let xStep: number | null = null;
  if (xType !== "category") {
    for (let i = 1; i < rows.length; i += 1) {
      const a = rows[i - 1]?.x;
      const b = rows[i]?.x;
      if (a === null || b === null || a === undefined || b === undefined) continue;
      const d = b - a;
      if (d > 0 && Number.isFinite(d) && (xStep === null || d < xStep)) xStep = d;
    }
  }
  if (xType === "time") {
    // Now that the data's own spacing is known, a daily series drops the clock.
    for (const row of rows) if (row.x !== null) row.label = timePointLabel(row.x, xStep, zone, locale);
  }

  const slots = assignSlots(tabulated.map((s) => s.slot));
  const series: ModelSeries[] = names.map((name, index) => {
    const slot = slots[index] ?? null;
    return { index, name, slot, shape: slot === null ? null : (SERIES_SHAPES[slot - 1] ?? null) };
  });

  const drawable = rows.some((r) => r.x !== null && r.values.some((v, i) => v !== null && (series[i]?.slot ?? null) !== null));

  return {
    xType,
    zone,
    locale,
    rows,
    series,
    xStep,
    dropped: { rows: Math.max(0, total - count), series: Math.max(0, suppliedSeries.length - tabulated.length), values: extraValues },
    drawable,
    formatX: (v) => tidyLabel(formatX(v), MAX_AXIS_CHARS),
  };
}

/* ------------------------------------------------------------------ */
/*  Table and notes                                                    */
/* ------------------------------------------------------------------ */

export interface ChartTable {
  /** The row header column's title ("Time", "Category"). */
  corner: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export function cartesianTable(model: CartesianModel, formatters: Formatters, corner: string): ChartTable {
  return {
    corner,
    columns: model.series.map((s) => s.name),
    rows: model.rows.map((row) => ({ label: row.label, cells: row.values.map((v) => formatters.value(v)) })),
  };
}

/** What a cap or a mismatch left out, counted; the renderer words it. */
export interface ChartNotes {
  rowsShown: number;
  rowsTotal: number;
  seriesDrawn: number;
  seriesTabulated: number;
  seriesTotal: number;
  /** Values past the end of `x`, which have nowhere to go. */
  valuesDropped: number;
}

export function cartesianNotes(model: CartesianModel): ChartNotes {
  const tabulated = model.series.length;
  return {
    rowsShown: model.rows.length,
    rowsTotal: model.rows.length + model.dropped.rows,
    seriesDrawn: model.series.filter((s) => s.slot !== null).length,
    seriesTabulated: tabulated,
    seriesTotal: tabulated + model.dropped.series,
    valuesDropped: model.dropped.values,
  };
}

/** Low, high and latest of the drawn values, for a summary a screen reader hears first. */
export function valueRange(model: CartesianModel): { low: number; high: number } | null {
  let low = Infinity;
  let high = -Infinity;
  for (const row of model.rows) {
    row.values.forEach((v, i) => {
      if (v === null || model.series[i]?.slot === null) return;
      if (v < low) low = v;
      if (v > high) high = v;
    });
  }
  return low <= high ? { low, high } : null;
}

/** The facts a line or bar chart's default summary is written from (see `ChartLabels.cartesianSummary`). */
export interface CartesianSummaryParts {
  /** The chart's kind, from `ChartLabels.kinds` ("Line chart"). */
  kind: string;
  /** The series' names, in order. Empty: no data. */
  series: string[];
  /** Rows, placed or not. 0: no data. */
  points: number;
  /** The first placed x label; `undefined` when nothing is placed. */
  first?: string;
  /** The last placed x label; `undefined` unless two or more are placed. */
  last?: string;
  /** The formatted value range; `undefined` when no value is present. */
  low?: string;
  high?: string;
}

/**
 * What a screen reader hears after the chart's name, when the caller wrote no
 * summary: the series, the span and the value range. The values themselves are
 * the table's job.
 */
export function cartesianSummaryParts(model: CartesianModel, formatters: Formatters): Omit<CartesianSummaryParts, "kind"> {
  const { series, rows } = model;
  const placed = rows.filter((r) => r.x !== null);
  const range = valueRange(model);
  return {
    series: series.map((s) => s.name),
    points: rows.length,
    first: placed[0]?.label,
    last: placed.length > 1 ? placed[placed.length - 1]?.label : undefined,
    ...(range && { low: formatters.value(range.low), high: formatters.value(range.high) }),
  };
}
