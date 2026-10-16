import { useMemo, useState } from "react";

import {
  Card,
  DataTable,
  FilterBar,
  type FilterDefinition,
  type FilterValues,
  filtersToSearchParams,
  searchParamsToFilters,
} from "../../../src";
import { makeServices, REGIONS_ALL, TEAMS } from "../data/fixtures";
import {
  matchService,
  REGION_FILTER,
  Row,
  SEARCH_FILTER,
  SERVICE_COLUMNS,
  SERVICE_FILTERS,
  Stack,
  STATUS_FILTER,
  TEAM_FILTER,
} from "./parts/services";

export const meta = {
  title: "FilterBar",
  group: "filters",
  order: 10,
  description:
    "A dashboard's filters composed from the existing controls (MultiSelect, ToggleGroup, RangeSlider, DateRangePicker with times, SearchInput, Select) by a typed list of definitions. Applied filters show as removable chips with Clear all and a result count that is announced once it settles. The bar folds into a \"Filters (n)\" button and a drawer by its OWN width (the narrow box below), never the viewport. The query line is `filtersToSearchParams`, and the dashboard starts from `searchParamsToFilters` of a sample URL.",
};

const FLEET = makeServices(48);

/** What a shared link would carry: the dashboard opens on it. */
const SAMPLE_QUERY = "region=eu-west&region=us-east&p95=300..&deployed=last-30-days";

function Dashboard() {
  const [values, setValues] = useState<FilterValues>(() => searchParamsToFilters(SAMPLE_QUERY, SERVICE_FILTERS));
  const rows = useMemo(() => FLEET.filter((s) => matchService(s, values)), [values]);
  const query = filtersToSearchParams(values, SERVICE_FILTERS).toString();
  return (
    <Card data-sc="filters-dashboard">
      <Card.Header>
        <Card.Title>Services</Card.Title>
      </Card.Header>
      <Card.Body className="grid gap-r3">
        <FilterBar filters={SERVICE_FILTERS} value={values} onValueChange={setValues} resultCount={rows.length} />
        <p className="text-body-3 text-fg-muted [overflow-wrap:anywhere]">
          URL query: <code data-sc="filters-query">{query === "" ? "(none)" : `?${query}`}</code>
        </p>
        <DataTable
          data-sc-scrolls
          aria-label="Filtered services"
          columns={SERVICE_COLUMNS}
          rows={rows}
          getRowKey={(s) => s.id}
          defaultSort={{ column: "status", direction: "desc" }}
          defaultPageSize={8}
        />
      </Card.Body>
    </Card>
  );
}

function Narrow() {
  const [values, setValues] = useState<FilterValues>({ region: ["eu-west"], status: ["serious", "error"] });
  const count = FLEET.filter((s) => matchService(s, values)).length;
  return (
    <div className="w-full max-w-column-lg rounded-lg border p-r4" data-sc="filters-narrow">
      <FilterBar filters={SERVICE_FILTERS} value={values} onValueChange={setValues} resultCount={count} />
    </div>
  );
}

const LONG_TEAMS: FilterDefinition = {
  id: "team",
  label: "Owning team (as listed in the service catalogue)",
  kind: "multi",
  options: TEAMS.map((t) => ({ value: t, label: t })),
};

const REGION_ERROR: FilterDefinition = {
  id: "region",
  label: "Region",
  kind: "multi",
  options: [],
  loadError: "Couldn't load regions",
};

const TEAM_LOADING: FilterDefinition = { id: "owner", label: "Team", kind: "select", searchable: true, options: [], loading: true };

const SMALL = [STATUS_FILTER, TEAM_FILTER, SEARCH_FILTER];

export default function FilterBarSection() {
  return (
    <Stack>
      <Row label="Dashboard: services table, wide container (inline controls)">
        <Dashboard />
      </Row>

      <Row label="Narrow container (a side panel): folded into Filters (n) and a drawer with the same controls">
        <Narrow />
      </Row>

      <Row label="Empty: nothing applied, the count alone">
        <FilterBar filters={SMALL} resultCount={48} data-sc="filters-empty" />
      </Row>

      <Row label="Loading results · options that failed to load · options on their way">
        <div className="grid gap-r4">
          <FilterBar filters={SMALL} defaultValue={{ status: ["error"] }} resultCount={6} loading />
          <FilterBar filters={[REGION_ERROR, TEAM_LOADING]} resultCount={48} collapse="never" />
        </div>
      </Row>

      <Row label="Disabled">
        <FilterBar filters={SMALL} defaultValue={{ status: ["warning"], q: "api" }} resultCount={3} disabled collapse="never" />
      </Row>

      <Row label="Long content: a long label and long chips truncate (the full text is the chip's title and its button's name)">
        <FilterBar
          filters={[LONG_TEAMS, REGION_FILTER]}
          defaultValue={{ team: TEAMS, region: REGIONS_ALL }}
          resultCount={1234567}
          data-sc="filters-long"
        />
      </Row>

      <Row label="Compact">
        <div data-density="compact">
          <FilterBar filters={SMALL} defaultValue={{ status: ["success"], team: "payments" }} resultCount={9} />
        </div>
      </Row>

      <Row label="Right to left">
        <div dir="rtl">
          <FilterBar filters={SERVICE_FILTERS} defaultValue={{ p95: [0, 800], q: "auth" }} resultCount={2} data-sc="filters-rtl" />
        </div>
      </Row>
    </Stack>
  );
}
