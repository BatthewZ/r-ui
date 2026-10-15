import { CircleCheck, LoaderCircle, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { Heatmap } from "../../../src/components/charts";
import { type DataTableColumn, DataTable, Meter } from "../../../src/components/data";
import { Inline, Stack } from "../../../src/components/layout";
import { Card, Link, StatusLabel, type Tone } from "../../../src/components/primitives";
import { formatCompact, formatPercent, formatUnit } from "../../../src/util/format";
import { type DashboardData, type Deploy, type DeployStatus, DEPLOYS, type Endpoint, INCIDENTS, SLOS, STATUS, WEEKDAYS } from "./data";
import { ago } from "./format";

/** Where the board places a card: a scroll target id and its grid classes. */
export interface Placement {
  id?: string;
  className?: string;
}

/** The cards' "see everything" links go nowhere in a specimen. */
const noop = (event: React.MouseEvent) => event.preventDefault();

/** Open incidents, most severe first: a status, what broke, where, how long, who has it. */
export function IncidentsCard(placement: Placement) {
  return (
    <Card {...placement}>
      <Card.Header>
        <Card.Title as="h2">Open incidents</Card.Title>
        <Card.Actions>
          <Link href="#incidents" onClick={noop}>
            All incidents
          </Link>
        </Card.Actions>
      </Card.Header>
      <Card.Body>
        <Stack as="ul" gap="r3">
          {INCIDENTS.map((incident) => (
            <Inline
              as="li"
              key={incident.title}
              justify="between"
              align="start"
              gap="r3"
              wrap={false}
              className="border-border not-first:border-t not-first:pt-r3"
            >
                <Stack gap="r6" className="min-w-0">
                  <StatusLabel tone={STATUS[incident.status].tone} className="text-body-3">
                    {STATUS[incident.status].label}
                  </StatusLabel>
                  <span className="text-body-2 font-medium">{incident.title}</span>
                  <span className="text-body-3 text-fg-muted">
                    {incident.service} · {incident.region} · opened {ago(incident.ageMin)} · {incident.owner}
                  </span>
                </Stack>
            </Inline>
          ))}
        </Stack>
      </Card.Body>
    </Card>
  );
}

/** Error budget left per SLO: a meter whose LOW end is the bad one. */
export function BudgetCard(placement: Placement) {
  return (
    <Card {...placement}>
      <Card.Header>
        <Card.Title as="h2">Error budget remaining</Card.Title>
        <Card.Description>30-day rolling window</Card.Description>
      </Card.Header>
      <Card.Body>
        <Stack gap="r3">
          {SLOS.map((slo) => (
            <Meter
              key={slo.service}
              value={slo.left}
              worse="low"
              thresholds={[
                { at: 50, tone: "warning" },
                { at: 25, tone: "error" },
              ]}
              label={
                <>
                  <span className="text-fg-primary">{slo.service}</span> · target{" "}
                  {formatPercent(slo.target, { maximumFractionDigits: 2 })}
                </>
              }
              valueText={`${formatPercent(slo.left / 100, { maximumFractionDigits: 0 })} left`}
            />
          ))}
        </Stack>
      </Card.Body>
    </Card>
  );
}

const DEPLOY_STATUS: Record<DeployStatus, { tone: Tone; label: string; icon?: ReactNode }> = {
  progress: { tone: "info", label: "Rolling out", icon: <LoaderCircle /> },
  good: { tone: "success", label: "Live", icon: <CircleCheck /> },
  rolledBack: { tone: "error", label: "Rolled back", icon: <Undo2 /> },
};

const DEPLOY_COLUMNS: DataTableColumn<Deploy>[] = [
  {
    id: "service",
    header: "Deploy",
    value: (d) => d.service,
    title: (d) => `${d.service} ${d.version}`,
    cell: (d) => (
      <>
        {d.service} <span className="font-mono text-fg-muted">{d.version}</span>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    truncate: false,
    sortable: false,
    cell: (d) => {
      const s = DEPLOY_STATUS[d.status];
      return (
        <StatusLabel tone={s.tone} icon={s.icon}>
          {s.label}
        </StatusLabel>
      );
    },
  },
  { id: "author", header: "By", value: (d) => d.author, truncate: false, priority: 3 },
  { id: "age", header: "When", value: (d) => d.ageMin, numeric: true, firstDirection: "asc", cell: (d) => ago(d.ageMin) },
];

/**
 * Recent deploys in a COMPACT card on a comfortable page: the card alone sets
 * `data-density="compact"`, and its table rows, type and padding re-derive
 * there. (At coarse input every row still meets the 44px hit floor.)
 */
export function DeploysCard(placement: Placement) {
  return (
    <Card {...placement} data-density="compact" data-dashboard-compact="">
      <Card.Header>
        <Card.Title as="h2">Recent deploys</Card.Title>
        <Card.Actions>
          <Link href="#deploys" onClick={noop}>
            Deploy log
          </Link>
        </Card.Actions>
      </Card.Header>
      <DataTable
        aria-label="Recent deploys"
        variant="rules"
        columns={DEPLOY_COLUMNS}
        rows={DEPLOYS}
        getRowKey={(d) => d.id}
        defaultSort={{ column: "age", direction: "asc" }}
      />
    </Card>
  );
}

const ENDPOINT_COLUMNS: DataTableColumn<Endpoint>[] = [
  {
    id: "name",
    header: "Endpoint",
    value: (e) => e.name,
    title: (e) => e.name,
    cell: (e) => <span className="font-mono">{e.name}</span>,
  },
  {
    id: "p95",
    header: "p95 vs 1.5 s budget",
    value: (e) => e.p95,
    firstDirection: "desc",
    truncate: false,
    cell: (e) => (
      <Meter
        variant="inline"
        label={`${e.name} p95 latency`}
        value={e.p95}
        max={1500}
        thresholds={[
          { at: 500, tone: "warning" },
          { at: 1000, tone: "error" },
        ]}
        valueText={formatUnit(e.p95, "millisecond")}
      />
    ),
  },
  { id: "calls", header: "Calls", value: (e) => e.calls, numeric: true, priority: 2, cell: (e) => formatCompact(e.calls) },
];

/** The slowest endpoints, as a table whose latency cells are meters against a budget. */
export function EndpointsCard({ data, ...placement }: { data: DashboardData } & Placement) {
  return (
    <Card {...placement}>
      <Card.Header>
        <Card.Title as="h2">Slowest endpoints</Card.Title>
        <Card.Description>p95 latency over the selected range</Card.Description>
      </Card.Header>
      <DataTable
        aria-label="Slowest endpoints"
        variant="rules"
        columns={ENDPOINT_COLUMNS}
        rows={data.endpoints}
        getRowKey={(e) => e.name}
        defaultSort={{ column: "p95", direction: "desc" }}
      />
    </Card>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/** 5xx errors by weekday × hour: when the server errors cluster, on the sequential ramp. */
export function HeatmapCard({ data, ...placement }: { data: DashboardData } & Placement) {
  return (
    <Card {...placement} data-dashboard-heatmap="">
      <Card.Header>
        <Card.Title as="h2">5xx errors by hour</Card.Title>
        <Card.Description>Last 7 days, local time</Card.Description>
      </Card.Header>
      <Card.Body>
        <Heatmap
          label="5xx errors by weekday and hour, last 7 days"
          rows={WEEKDAYS}
          columns={HOURS}
          values={data.heat}
          valueLabel="5xx errors"
        />
      </Card.Body>
    </Card>
  );
}
