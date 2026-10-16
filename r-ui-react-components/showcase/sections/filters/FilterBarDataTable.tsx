import { useMemo, useState } from "react";

import {
  DataTable,
  type DataTableColumn,
  type DataTableFilters,
  FilterBar,
  type FilterDefinition,
  type FilterValues,
} from "../../../src";
import { type FleetService, makeServices, TEAMS } from "../data/fixtures";
import { matchService, Row, SERVICE_COLUMNS, Stack, STATUS_FILTER } from "./parts/services";

export const meta = {
  title: "FilterBar with DataTable filters",
  group: "filters",
  order: 20,
  description:
    "Bridging without coupling: FilterBar's value and DataTable's `filters` are both a record of values by id. The bar's Service search and Team select use the column ids `name` and `owner`, whose text and select filters take the same string values, so that slice of one state goes into the table's `filters` (the table matches it, and its own filter row edits it: a change in either shows in both). Status has no column filter, so the page matches it before the rows reach the table. Each side's Clear touches only its own keys.",
};

const FLEET = makeServices(24);

/** The ids the bar and the table share: a text filter and a select filter take the same string values. */
const SHARED = ["name", "owner"] as const;

const BAR_FILTERS: FilterDefinition[] = [
  { id: "name", label: "Service", kind: "search", placeholder: "Service name" },
  { id: "owner", label: "Team", kind: "select", options: TEAMS.map((t) => ({ value: t, label: t })) },
  STATUS_FILTER,
];

const COLUMNS: DataTableColumn<FleetService>[] = SERVICE_COLUMNS.map((c) =>
  c.id === "name"
    ? { ...c, filter: { type: "text", placeholder: "Name" } }
    : c.id === "owner"
      ? { ...c, filter: { type: "select", options: TEAMS.map((t) => ({ value: t, label: t })) } }
      : c,
);

const pick = (values: FilterValues): DataTableFilters =>
  Object.fromEntries(Object.entries(values).filter(([key]) => (SHARED as readonly string[]).includes(key)));

export default function FilterBarDataTableSection() {
  const [values, setValues] = useState<FilterValues>({ owner: "payments" });
  // The page matches what only the bar knows (status); the table matches its own columns' filters.
  const rows = useMemo(() => FLEET.filter((s) => matchService(s, { status: values.status })), [values.status]);
  const onFiltersChange = (filters: DataTableFilters) =>
    setValues((prev) => ({
      ...Object.fromEntries(Object.entries(prev).filter(([key]) => !(SHARED as readonly string[]).includes(key))),
      ...filters,
    }));
  return (
    <Stack>
      <Row label="One state: the bar's name and owner are the table's column filters">
        <div className="grid gap-r3" data-sc="filters-bridge">
          <FilterBar filters={BAR_FILTERS} value={values} onValueChange={setValues} />
          <DataTable
            data-sc-scrolls
            aria-label="Services, filtered by the bar and the table"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(s) => s.id}
            filters={pick(values)}
            onFiltersChange={onFiltersChange}
            defaultPageSize={8}
          />
        </div>
      </Row>
    </Stack>
  );
}
