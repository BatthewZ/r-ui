import type { DateRange, DateRangePreset } from "../../../src/components/dates";
import {
  type FilterDefinition,
  type FilterValues,
  filtersToSearchParams,
  searchParamsToFilters,
} from "../../../src/components/filters";
import { dateTimeFormatter } from "../../../src/util/format";
import {
  DAY_MS,
  type Env,
  NOW,
  type Region,
  REGIONS,
  RETENTION_DAYS,
  type Service,
  type ServiceStatus,
  STATUS,
  type TimeWindow,
  windowShape,
} from "./data";
import { shortSpan, stepText } from "./format";

/** Rolling windows ending at the picker's `now` (the FilterBar passes the specimen's frozen NOW). */
const lastFrom =
  (ms: number): DateRangePreset["range"] =>
  (now) => ({ start: new Date(now.getTime() - ms), end: now });

/** The specimen's clock, frozen: the presets, the bar and the URL all resolve against it. */
export const CLOCK = new Date(NOW);

export const PRESETS: DateRangePreset[] = [
  { id: "last-24-hours", label: "Last 24 hours", range: lastFrom(DAY_MS) },
  { id: "last-7-days", label: "Last 7 days", range: lastFrom(7 * DAY_MS) },
  { id: "last-30-days", label: "Last 30 days", range: lastFrom(30 * DAY_MS) },
  { id: "last-90-days", label: `Last ${RETENTION_DAYS} days`, range: lastFrom(RETENTION_DAYS * DAY_MS) },
];

const STATUS_ORDER: ServiceStatus[] = ["critical", "serious", "warning", "stale", "good"];

/** Time and region narrow every card; status, latency and search narrow the services table. */
export const FILTERS: FilterDefinition[] = [
  {
    id: "time",
    label: "Time range",
    kind: "dateRange",
    withTime: true,
    presets: PRESETS,
    min: new Date(NOW - RETENTION_DAYS * DAY_MS),
    max: CLOCK,
    placeholder: `All ${RETENTION_DAYS} days`,
  },
  { id: "region", label: "Region", kind: "multi", options: REGIONS.map((r) => ({ value: r, label: r })), placeholder: "All regions" },
  { id: "status", label: "Status", kind: "toggle", options: STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label })) },
  {
    id: "p95",
    label: "p95 latency",
    kind: "range",
    min: 0,
    max: 2000,
    step: 50,
    formatOptions: { style: "unit", unit: "millisecond" },
  },
  { id: "q", label: "Search services", kind: "search", placeholder: "Service or team" },
];

/** The filters only the services table reads: what its empty state's "Clear filters" removes. */
export const SERVICE_FILTER_IDS: readonly string[] = ["status", "p95", "q"];

const DEFAULT_PRESET = PRESETS[1]!;
export const DEFAULT_FILTERS: FilterValues = {
  time: { ...DEFAULT_PRESET.range(CLOCK), preset: DEFAULT_PRESET.id },
};

const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** What the filters ask of the data, and how the cards describe it. */
export interface DashboardView {
  window: TimeWindow;
  /** Empty: every region. */
  regions: Region[];
  /** "Last 7 days", or the custom range's own dates and times. */
  span: string;
  /** `span` inside a sentence ("last 7 days"). */
  phrase: string;
  /** The KPI deltas' comparison ("vs prior 7d"). */
  prior: string;
  /** "hourly", "4-hour intervals", "daily". */
  step: string;
}

/** No time filter is all the retained data. */
export function viewOf(values: FilterValues): DashboardView {
  const time = values.time as DateRange<Date> | undefined;
  const window = time
    ? { start: time.start.getTime(), end: time.end.getTime() }
    : { start: NOW - RETENTION_DAYS * DAY_MS, end: NOW };
  const preset = time ? PRESETS.find((p) => p.id === time.preset) : PRESETS[PRESETS.length - 1];
  const span =
    preset?.label ??
    dateTimeFormatter(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatRange(
      window.start,
      window.end,
    );
  return {
    window,
    span,
    phrase: preset ? span.toLowerCase() : span,
    regions: list(values.region).filter((r): r is Region => (REGIONS as readonly string[]).includes(r)),
    prior: `vs prior ${shortSpan(window.end - window.start)}`,
    step: stepText(windowShape(window).stepHours),
  };
}

/** Whether a service passes the table's filters (status, latency, search over names and teams). */
export function matchService(s: Service, values: FilterValues): boolean {
  const statuses = list(values.status);
  if (statuses.length > 0 && !statuses.includes(s.status)) return false;
  const p95 = values.p95 as [number, number] | undefined;
  if (p95 && (s.p95 === null || s.p95 < p95[0] || s.p95 > p95[1])) return false;
  const needle = typeof values.q === "string" ? values.q.trim().toLowerCase() : "";
  return !needle || s.name.includes(needle) || s.owner.toLowerCase().includes(needle);
}

/**
 * The view as the Dashboard's hash anchor (`#/dashboard/<query>`): what differs
 * from the default filters, plus the environment. The default view is the
 * empty anchor, so opening the page does not rewrite its URL; no time filter
 * (all retained data) is written as an empty `time=`.
 */
export function toAnchor(values: FilterValues, env: Env): string {
  return filtersToSearchParams(values, FILTERS, {
    base: env === "staging" ? "env=staging" : "",
    defaults: DEFAULT_FILTERS,
  }).toString();
}

/** The view an anchor holds; a missing filter is its default. Unknown or malformed parameters are dropped. */
export function fromAnchor(anchor: string | null): { values: FilterValues; env: Env } {
  const params = new URLSearchParams(anchor ?? "");
  return {
    values: searchParamsToFilters(params, FILTERS, { now: CLOCK, defaults: DEFAULT_FILTERS }),
    env: params.get("env") === "staging" ? "staging" : "production",
  };
}
