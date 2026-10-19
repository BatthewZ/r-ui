import { CircleCheck, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { Heatmap } from "../../../src/components/charts";
import { type DataTableColumn, DataTable, Meter, Timeline, type TimelineEvent } from "../../../src/components/data";
import { ProgressRing } from "../../../src/components/feedback";
import { Inline, Stack } from "../../../src/components/layout";
import { Card, Link, StatusLabel, type Tone } from "../../../src/components/primitives";
import { formatCompact, formatNumber, formatPercent, formatUnit } from "../../../src/util/format";
import { type DashboardData, type Deploy, type DeployStatus, DEPLOYS, type Endpoint, INCIDENTS, NOW, SLOS, STATUS, WEEKDAYS } from "./data";
import { ago } from "./format";

/** Where the board places a card: a scroll target id and its grid classes. */
export interface Placement {
  id?: string;
  className?: string;
}

/** The cards' "see everything" links go nowhere in a specimen. */
const noop = (event: React.MouseEvent) => event.preventDefault();

const INCIDENT_EVENTS: TimelineEvent[] = INCIDENTS.map((incident) => ({
  id: incident.title,
  time: NOW - incident.ageMin * 60_000,
  tone: STATUS[incident.status].tone,
  statusLabel: STATUS[incident.status].label,
  title: incident.title,
  actor: incident.owner,
  meta: `${incident.service} · ${incident.region}`,
}));

/**
 * Open incidents as a flat Timeline, newest first (here also the most severe):
 * the status as mark, glyph and word, what broke, who has it and where, and how
 * long ago it opened as a `<time>` with the full reading on hover and focus.
 */
export function IncidentsCard(placement: Placement) {
  return (
    <Card {...placement} data-dashboard-incidents="">
      <Card.Header>
        <Card.Title as="h2">Open incidents</Card.Title>
        <Card.Actions>
          <Link href="#incidents" onClick={noop}>
            All incidents
          </Link>
        </Card.Actions>
      </Card.Header>
      <Card.Body>
        <Timeline events={INCIDENT_EVENTS} now={NOW} groupByDay={false} label="Open incidents" />
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

export const DEPLOY_STATUS: Record<DeployStatus, { tone: Tone; label: string; icon?: ReactNode }> = {
  progress: { tone: "info", label: "Rolling out" },
  good: { tone: "success", label: "Live", icon: <CircleCheck /> },
  rolledBack: { tone: "error", label: "Rolled back", icon: <Undo2 /> },
};

/**
 * A deploy's state. A rollout under way is work toward done, so its mark is a
 * ProgressRing at the share of hosts updated (named, with its value, for a
 * reader); the others are a status glyph and word.
 */
export function DeployState({ deploy }: { deploy: Deploy }) {
  const s = DEPLOY_STATUS[deploy.status];
  const { rollout } = deploy;
  if (deploy.status === "progress" && rollout) {
    return (
      <Inline as="span" gap="r6" wrap={false} className="text-fg-primary">
        <ProgressRing
          size="icon"
          value={rollout.hosts}
          max={rollout.of}
          label={`Rollout of ${deploy.service} ${deploy.version}`}
          valueText={`${formatNumber(rollout.hosts)} of ${formatNumber(rollout.of)} hosts`}
        />
        {s.label}
      </Inline>
    );
  }
  return (
    <StatusLabel tone={s.tone} icon={s.icon}>
      {s.label}
    </StatusLabel>
  );
}

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
    cell: (d) => <DeployState deploy={d} />,
  },
  { id: "author", header: "By", value: (d) => d.author, truncate: false, priority: 3 },
  { id: "age", header: "When", value: (d) => d.ageMin, numeric: true, firstDirection: "asc", cell: (d) => ago(d.ageMin) },
];

/**
 * Recent deploys in a COMPACT card on a comfortable page: the card alone sets
 * `data-density="compact"`, and its table rows, type and padding re-derive
 * there. (At coarse input every row still meets the 44px hit floor.) The
 * rollout under way carries its progress.
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
