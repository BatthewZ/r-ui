import type { ReactNode } from "react";

import { dateTimeFormatter, formatNumber, type FormatNumberOptions } from "../../util/format";
import { type DateRange, DEFAULT_DATE_RANGE_PRESETS, type DateRangePreset } from "../dates";

/**
 * The filters' values, by filter id: a `Record`, like DataTable's `filters`.
 * A filter that is not applied has no key. Value shapes by kind:
 * `select` and `search` a string, `multi` and `toggle` a list of strings,
 * `range` a `[low, high]` pair, `dateRange` a `DateRange<Date>`, `custom`
 * whatever its control writes.
 */
export type FilterValues = Readonly<Record<string, unknown>>;

/** A choice of a `select`, `multi` or `toggle` filter. */
export interface FilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FilterBase<TValue> {
  /** The key in `FilterValues` (and in the URL). */
  id: string;
  /** The control's label and the chip's subject ("Region"). */
  label: string;
  /** The chip's whole text for an applied value. Default: per kind (`FilterBarLabels`). */
  format?: (value: TValue) => string;
  disabled?: boolean;
}

/** One choice: a native `Select` with an "Any" first option, or a `Combobox` when `searchable`. */
export interface SelectFilterDefinition extends FilterBase<string> {
  kind: "select";
  options: readonly FilterOption[];
  searchable?: boolean;
  /** The no-filter text. Default `labels.any`. */
  placeholder?: string;
  /** With `searchable`: the options are on their way. */
  loading?: boolean;
  /** With `searchable`: the options could not be loaded. */
  loadError?: string;
}

/** Any number of choices: a `MultiSelect`, or a `TagInput` (free values, `options` as suggestions) when `creatable`. */
export interface MultiFilterDefinition extends FilterBase<string[]> {
  kind: "multi";
  options: readonly FilterOption[];
  creatable?: boolean;
  placeholder?: string;
  /** A "Select all" row (MultiSelect). */
  selectAll?: boolean;
  loading?: boolean;
  loadError?: string;
}

/**
 * A span of a scale: a `RangeSlider`. The whole scale is no filter, so a
 * low end at `min` reads "≤ high" and a high end at `max` reads "≥ low".
 */
export interface RangeFilterDefinition extends FilterBase<[number, number]> {
  kind: "range";
  min: number;
  max: number;
  /** Default 1. */
  step?: number;
  /** How the slider and the chip write a number (`{ style: "unit", unit: "millisecond" }`). */
  formatOptions?: Omit<FormatNumberOptions, "locale" | "missing">;
}

/** A time range: a `DateRangePicker`. A preset's chip is its label ("Last 7 days"). */
export interface DateRangeFilterDefinition extends FilterBase<DateRange<Date>> {
  kind: "dateRange";
  /** Times of day on each end (`DateRangePicker withTime`). */
  withTime?: boolean;
  /** Default `DEFAULT_DATE_RANGE_PRESETS`; `[]` for none. */
  presets?: DateRangePreset[];
  min?: Date;
  max?: Date;
}

/**
 * Toggles: a `ToggleGroup`. The value is always a list; `exclusive` makes it a
 * one-of-many choice (radios) that moves but never clears, except by its chip.
 */
export interface ToggleFilterDefinition extends FilterBase<string[]> {
  kind: "toggle";
  options: readonly FilterOption[];
  exclusive?: boolean;
}

/** Free text: a `SearchInput`. Applied while it holds more than spaces. */
export interface SearchFilterDefinition extends FilterBase<string> {
  kind: "search";
  placeholder?: string;
}

/** What a `custom` filter's `render` is given. Render it inside the Field the bar provides (its label names the control). */
export interface FilterControlProps {
  /** The filter's value; `undefined` while not applied. */
  value: unknown;
  /** Set the value; one the filter's `isActive` refuses removes the filter. */
  onValueChange: (value: unknown) => void;
  /** The filter's label, for a control that needs an `aria-label`. */
  label: string;
  /** The Field's control id: put it on a native control so the filter's label names it. The library's controls read the Field themselves. */
  id: string;
  disabled: boolean;
}

/** The caller's own control. `format` writes its chip, and `toParam`/`fromParam` put it in a URL. */
export interface CustomFilterDefinition extends FilterBase<unknown> {
  kind: "custom";
  render: (control: FilterControlProps) => ReactNode;
  format: (value: unknown) => string;
  /** Default: anything but `undefined`, `null`, `""` and `[]`. */
  isActive?: (value: unknown) => boolean;
  /** The value as URL parameter values; without it the filter stays out of the URL. */
  toParam?: (value: unknown) => string[];
  /** The value back from the URL parameter's values. */
  fromParam?: (params: string[]) => unknown;
}

/** One filter of a `FilterBar`, by `kind`. */
export type FilterDefinition =
  | SelectFilterDefinition
  | MultiFilterDefinition
  | RangeFilterDefinition
  | DateRangeFilterDefinition
  | ToggleFilterDefinition
  | SearchFilterDefinition
  | CustomFilterDefinition;

export type FilterKind = FilterDefinition["kind"];

/** The words a chip is made of. A subset of `FilterBarLabels`. */
export interface FilterChipLabels {
  /** A filter's label and its applied choices ("Region: eu-west, us-east"). */
  value: (label: string, summary: string) => string;
  /** A search's text ("Search: “checkout”"). */
  search: (label: string, text: string) => string;
  /** A range from `min` ("p95 ≤ 800 ms"); the numbers are written with the filter's `formatOptions`. */
  atMost: (label: string, value: string) => string;
  /** A range up to `max` ("p95 ≥ 300 ms"). */
  atLeast: (label: string, value: string) => string;
  /** A range inside the scale ("p95 300–800 ms"); `range` is the locale's own range of the two numbers. */
  between: (label: string, range: string) => string;
  /** A list of choices in a chip, joined. */
  list: (items: string[]) => string;
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isDateRange = (value: unknown): value is DateRange<Date> =>
  typeof value === "object" &&
  value !== null &&
  (value as DateRange).start instanceof Date &&
  (value as DateRange).end instanceof Date &&
  !Number.isNaN((value as DateRange<Date>).start.getTime()) &&
  !Number.isNaN((value as DateRange<Date>).end.getTime());

/** The range's ends on the scale: clamped and ordered; `null` when it is not a pair of finite numbers. */
export function clampRange(def: RangeFilterDefinition, value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [a, b] = value as unknown[];
  if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const clamp = (n: number) => Math.min(def.max, Math.max(def.min, n));
  return a <= b ? [clamp(a), clamp(b)] : [clamp(b), clamp(a)];
}

const isGenericActive = (value: unknown) =>
  value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

/**
 * The value as the filter holds it once applied, or `undefined` when it applies
 * nothing (a `FilterValues` object then has no key for it).
 */
export function normalizeFilterValue(def: FilterDefinition, value: unknown): unknown {
  switch (def.kind) {
    case "select":
      return typeof value === "string" && value !== "" ? value : undefined;
    case "search":
      return typeof value === "string" && value.trim() !== "" ? value : undefined;
    case "multi":
    case "toggle":
      return isStringList(value) && value.length > 0 ? value : undefined;
    case "range": {
      const range = clampRange(def, value);
      return range && (range[0] > def.min || range[1] < def.max) ? range : undefined;
    }
    case "dateRange":
      return isDateRange(value) ? value : undefined;
    case "custom":
      return (def.isActive ?? isGenericActive)(value) ? value : undefined;
  }
}

/** `values` with `def`'s value set (or removed, when it applies nothing). The same object when nothing changes. */
export function setFilterValue(values: FilterValues, def: FilterDefinition, next: unknown): FilterValues {
  const normalized = normalizeFilterValue(def, next);
  if (normalized === undefined) {
    if (!(def.id in values)) return values;
    const { [def.id]: _removed, ...rest } = values;
    return rest;
  }
  return { ...values, [def.id]: normalized };
}

/** `values` without any of `filters`' keys. Keys the bar does not define (another control's) are kept. */
export function clearFilterValues(values: FilterValues, filters: readonly FilterDefinition[]): FilterValues {
  const ids = new Set(filters.map((f) => f.id));
  if (!Object.keys(values).some((key) => ids.has(key))) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => !ids.has(key)));
}

/** The filters with an applied value, in definition order. */
export function appliedFilters(filters: readonly FilterDefinition[], values: FilterValues): FilterDefinition[] {
  return filters.filter((f) => normalizeFilterValue(f, values[f.id]) !== undefined);
}

const optionLabel = (options: readonly FilterOption[], value: string) => options.find((o) => o.value === value)?.label ?? value;

/** The chosen values' labels in the options' order (how the control lists them), values no option names last. */
function choiceLabels(options: readonly FilterOption[], values: readonly string[]): string[] {
  const rank = (v: string) => {
    const i = options.findIndex((o) => o.value === v);
    return i === -1 ? options.length : i;
  };
  return values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i)
    .map(({ v }) => optionLabel(options, v));
}

/** "Oct 1 – 7, 2026" (or with times), in the Gregorian calendar the pickers use. */
function dateRangeText(range: DateRange<Date>, locale: string | undefined, withTime: boolean): string {
  const format = dateTimeFormatter(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    calendar: "gregory",
  });
  const same = withTime
    ? range.start.getTime() === range.end.getTime()
    : range.start.toDateString() === range.end.toDateString();
  return same ? format.format(range.start) : format.formatRange(range.start, range.end);
}

/**
 * An applied filter's chip text: the filter's own `format`, else per kind.
 * `value` must be applied (`normalizeFilterValue` returns it).
 */
export function filterChipText(def: FilterDefinition, value: unknown, labels: FilterChipLabels, locale: string | undefined): string {
  switch (def.kind) {
    case "select": {
      const v = value as string;
      return def.format ? def.format(v) : labels.value(def.label, optionLabel(def.options, v));
    }
    case "multi":
    case "toggle": {
      const v = value as string[];
      return def.format ? def.format(v) : labels.value(def.label, labels.list(choiceLabels(def.options, v)));
    }
    case "search": {
      const v = value as string;
      return def.format ? def.format(v) : labels.search(def.label, v.trim());
    }
    case "range": {
      const v = value as [number, number];
      if (def.format) return def.format(v);
      const write = (n: number) => formatNumber(n, { locale, ...def.formatOptions });
      if (v[0] <= def.min) return labels.atMost(def.label, write(v[1]));
      if (v[1] >= def.max) return labels.atLeast(def.label, write(v[0]));
      // "300–800 ms": the unit once, where the locale puts it.
      const range = new Intl.NumberFormat(locale, { signDisplay: "negative", ...def.formatOptions }).formatRange(v[0], v[1]);
      return labels.between(def.label, range);
    }
    case "dateRange": {
      const v = value as DateRange<Date>;
      if (def.format) return def.format(v);
      const preset = v.preset ? (def.presets ?? DEFAULT_DATE_RANGE_PRESETS).find((p) => p.id === v.preset) : undefined;
      return preset ? preset.label : labels.value(def.label, dateRangeText(v, locale, def.withTime === true));
    }
    case "custom":
      return def.format(value);
  }
}
