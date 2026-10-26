import type { ReactNode } from "react";

import {
  type DataTableColumn,
  type DateRange,
  type FilterDefinition,
  type FilterValues,
  StatusLabel,
} from "../../../../src";
import { ago, type FleetService, REGIONS_ALL, STATUS_LABEL, STATUS_RANK, type ServiceStatus, TEAMS } from "../../data/fixtures";
import { DemoLabel } from "../../../shell/DemoLabel";

/** A labelled row inside a filters demo. In a subfolder, which the section registry does not glob. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-r5">
      <DemoLabel>{label}</DemoLabel>
      {children}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-r2">{children}</div>;
}

/** Deploy times are minutes before this instant, so the time filter has something to cut. */
export const NOW = Date.now();

const STATUSES: ServiceStatus[] = ["success", "warning", "serious", "error", "stale"];

export const REGION_FILTER: FilterDefinition = {
  id: "region",
  label: "Region",
  kind: "multi",
  options: REGIONS_ALL.map((r) => ({ value: r, label: r })),
  placeholder: "Any region",
};

export const STATUS_FILTER: FilterDefinition = {
  id: "status",
  label: "Status",
  kind: "toggle",
  options: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
};

export const SEARCH_FILTER: FilterDefinition = { id: "q", label: "Search", kind: "search", placeholder: "Service or team" };

/** The dashboard's filters over the services table. */
export const SERVICE_FILTERS: FilterDefinition[] = [
  REGION_FILTER,
  STATUS_FILTER,
  { id: "p95", label: "p95", kind: "range", min: 0, max: 2000, step: 50, formatOptions: { style: "unit", unit: "millisecond" } },
  { id: "deployed", label: "Deployed", kind: "dateRange", withTime: true },
  SEARCH_FILTER,
];

/** The team filter some demos add, as a plain select. */
export const TEAM_FILTER: FilterDefinition = {
  id: "team",
  label: "Team",
  kind: "select",
  options: TEAMS.map((t) => ({ value: t, label: t })),
};

const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/**
 * Whether a service passes the applied filters. The bar only holds values; the
 * page decides what they mean for its rows (here in the browser, or as a
 * server query from `filtersToSearchParams`).
 */
export function matchService(s: FleetService, values: FilterValues): boolean {
  const regions = list(values.region);
  if (regions.length > 0 && !regions.includes(s.region)) return false;
  const statuses = list(values.status);
  if (statuses.length > 0 && !statuses.includes(s.status)) return false;
  if (typeof values.team === "string" && s.owner !== values.team) return false;
  const p95 = values.p95;
  if (Array.isArray(p95)) {
    const [low, high] = p95 as [number, number];
    if (s.p95 === null || s.p95 < low || s.p95 > high) return false;
  }
  const deployed = values.deployed as DateRange<Date> | undefined;
  if (deployed) {
    const at = NOW - s.deployedMinutesAgo * 60_000;
    if (at < deployed.start.getTime() || at > deployed.end.getTime()) return false;
  }
  const q = typeof values.q === "string" ? values.q.trim().toLowerCase() : "";
  return q === "" || s.name.toLowerCase().includes(q) || s.owner.toLowerCase().includes(q);
}

export const SERVICE_COLUMNS: DataTableColumn<FleetService>[] = [
  { id: "name", header: "Service", value: (s) => s.name, cell: (s) => <span className="font-semibold">{s.name}</span> },
  { id: "owner", header: "Team", value: (s) => s.owner, priority: 3 },
  {
    id: "status",
    header: "Status",
    value: (s) => STATUS_RANK[s.status],
    firstDirection: "desc",
    truncate: false,
    title: (s) => STATUS_LABEL[s.status],
    cell: (s) => <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>,
  },
  { id: "p95", header: "p95 ms", value: (s) => s.p95, numeric: true },
  { id: "region", header: "Region", value: (s) => s.region, truncate: false, priority: 2 },
  {
    id: "deploy",
    header: "Last deploy",
    value: (s) => s.deployedMinutesAgo,
    numeric: true,
    priority: 4,
    firstDirection: "asc",
    cell: (s) => ago(s.deployedMinutesAgo),
  },
];
