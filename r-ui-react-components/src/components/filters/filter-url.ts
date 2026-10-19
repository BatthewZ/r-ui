import { type DateRange, DEFAULT_DATE_RANGE_PRESETS, parseISODate, toISODate, toISODateTime } from "../dates";

import { type FilterDefinition, type FilterOption, type FilterValues, normalizeFilterValue, setFilterValue } from "./filter-model";

/** Where the filters sit in a query string. */
export interface FilterUrlOptions {
  /** Put before every filter's parameter name (`"f."` → `f.region`), to keep them apart from the page's own. */
  prefix?: string;
  /**
   * The view a URL without the filter's parameter means (a page that opens on
   * "last 7 days"). Writing, a filter at its default is left out, so the
   * default view is the bare URL, and a filter removed where the default
   * applies one is written empty (`time=`). Reading, a missing parameter is
   * the default and an empty one is no filter. Pass the same to both.
   */
  defaults?: FilterValues;
}

/** Whether two values of `def` write the same parameters (a preset by its id, so its resolved instants never differ). */
const sameParams = (def: FilterDefinition, a: unknown, b: unknown) => {
  const x = a === undefined ? [] : encode(def, a);
  const y = b === undefined ? [] : encode(def, b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * The applied filters as URL search parameters, one name per filter id
 * (prefixed): a choice or a text as itself; each choice of a list as its own
 * repeated parameter (`region=eu-west&region=us-east`); a range as
 * `low..high`, an end at the scale's bound left out (`p95=300..`); a time range
 * as its preset's id (`time=last-7-days`, resolved again when read) or an ISO
 * 8601 interval of days (`2026-10-01/2026-10-07`), or with times, of local
 * date-times with their offset. A `custom` filter goes in through its `toParam`.
 *
 * `base` keeps its other parameters; every parameter the filters own is
 * replaced, so a filter that was removed leaves the URL too. With `defaults`,
 * only what differs from them is written. Pure: no router, no `location`.
 * `params.toString()` is the query string.
 */
export function filtersToSearchParams(
  values: FilterValues,
  filters: readonly FilterDefinition[],
  { prefix = "", base, defaults = {} }: FilterUrlOptions & { base?: URLSearchParams | string } = {},
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const def of filters) params.delete(prefix + def.id);
  for (const def of filters) {
    const value = normalizeFilterValue(def, values[def.id]);
    const fallback = normalizeFilterValue(def, defaults[def.id]);
    if (sameParams(def, value, fallback)) continue;
    if (value === undefined) {
      params.append(prefix + def.id, "");
      continue;
    }
    for (const item of encode(def, value)) params.append(prefix + def.id, item);
  }
  return params;
}

/**
 * The filters a URL's search parameters hold (see `filtersToSearchParams`).
 * Whatever does not read as its filter's value is left out: a choice that is
 * not an option (except a creatable `multi`), a number that is not one, an
 * interval whose end is before its start, an unknown preset. A preset is
 * resolved against `now`. With `defaults`, a filter whose parameter is
 * missing takes its default, and an empty parameter (`time=`) is no filter.
 * Parameters for ids the filters do not define are ignored.
 */
export function searchParamsToFilters(
  search: URLSearchParams | string,
  filters: readonly FilterDefinition[],
  { prefix = "", now = new Date(), defaults = {} }: FilterUrlOptions & { now?: Date } = {},
): FilterValues {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  let values: FilterValues = {};
  for (const def of filters) {
    const raw = params.getAll(prefix + def.id);
    if (raw.length === 0) values = setFilterValue(values, def, defaults[def.id]);
    else if (raw.every((item) => item === "")) continue;
    else values = setFilterValue(values, def, decode(def, raw, now));
  }
  return values;
}

function encode(def: FilterDefinition, value: unknown): string[] {
  switch (def.kind) {
    case "select":
    case "search":
      return [value as string];
    case "multi":
    case "toggle":
      return value as string[];
    case "range": {
      const [low, high] = value as [number, number];
      return [`${low > def.min ? low : ""}..${high < def.max ? high : ""}`];
    }
    case "dateRange": {
      const range = value as DateRange<Date>;
      if (range.preset && (def.presets ?? DEFAULT_DATE_RANGE_PRESETS).some((p) => p.id === range.preset)) return [range.preset];
      const write = def.withTime ? toISODateTime : toISODate;
      return [`${write(range.start)}/${write(range.end)}`];
    }
    case "custom":
      return def.toParam?.(value) ?? [];
  }
}

const known = (options: readonly FilterOption[], value: string) => options.some((o) => o.value === value);
const unique = (list: string[]) => [...new Set(list)];

/** A local date-time with its offset (`2026-10-01T09:00+02:00`), or a calendar date at local midnight. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseEnd(text: string): Date | null {
  if (DATE_TIME.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parseISODate(text);
}

function parseNumber(text: string, fallback: number): number | null {
  if (text.trim() === "") return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function decode(def: FilterDefinition, raw: string[], now: Date): unknown {
  const first = raw[0] ?? "";
  switch (def.kind) {
    case "select":
      return known(def.options, first) ? first : undefined;
    case "search":
      return first;
    case "multi":
      return unique(def.creatable ? raw : raw.filter((v) => known(def.options, v)));
    case "toggle": {
      const list = unique(raw.filter((v) => known(def.options, v)));
      return def.exclusive ? list.slice(0, 1) : list;
    }
    case "range": {
      const parts = first.split("..");
      if (parts.length !== 2) return undefined;
      const low = parseNumber(parts[0] ?? "", def.min);
      const high = parseNumber(parts[1] ?? "", def.max);
      return low === null || high === null || low > high ? undefined : [low, high];
    }
    case "dateRange": {
      if (!first.includes("/")) {
        const preset = (def.presets ?? DEFAULT_DATE_RANGE_PRESETS).find((p) => p.id === first);
        return preset ? { ...preset.range(now, { withTime: def.withTime === true }), preset: preset.id } : undefined;
      }
      const [startText = "", endText = ""] = first.split("/");
      const start = parseEnd(startText);
      const end = parseEnd(endText);
      return start && end && end.getTime() >= start.getTime() ? { start, end } : undefined;
    }
    case "custom":
      return def.fromParam?.(raw);
  }
}
