import { SearchX } from "lucide-react";

import { type DataTableColumn, DataTable, EmptyState, Meter } from "../../../src/components/data";
import { SegmentedControl } from "../../../src/components/form";
import { Inline } from "../../../src/components/layout";
import { Button, Card, StatusLabel } from "../../../src/components/primitives";
import { formatNumber, formatPercent } from "../../../src/util/format";
import { type Service, type ServiceStatus, STATUS } from "./data";
import { ago } from "./format";

export type ServiceFilter = "all" | "attention";

const COLUMNS: DataTableColumn<Service>[] = [
  {
    id: "name",
    header: "Service",
    value: (s) => s.name,
    title: (s) => `${s.name} · ${s.owner}`,
    cell: (s) => (
      <>
        <span className="font-medium">{s.name}</span> <span className="text-fg-muted">{s.owner}</span>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    truncate: false,
    value: (s) => STATUS[s.status].rank,
    firstDirection: "desc",
    cell: (s) => <StatusLabel tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusLabel>,
  },
  { id: "rps", header: "Req/s", numeric: true, priority: 3, value: (s) => s.rps },
  { id: "p95", header: "p95 ms", numeric: true, priority: 2, value: (s) => s.p95 },
  {
    id: "errors",
    header: "Errors",
    numeric: true,
    priority: 4,
    value: (s) => s.errors,
    cell: (s) => formatPercent(s.errors, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    id: "cpu",
    header: "CPU",
    truncate: false,
    priority: 4,
    value: (s) => s.cpu,
    firstDirection: "desc",
    cell: (s) => (
      <Meter
        variant="inline"
        label={`${s.name} CPU`}
        value={s.cpu}
        thresholds={[
          { at: 80, tone: "warning" },
          { at: 90, tone: "error" },
        ]}
      />
    ),
  },
  {
    id: "deploy",
    header: "Last deploy",
    numeric: true,
    priority: 5,
    value: (s) => s.deployedMin,
    firstDirection: "asc",
    cell: (s) => ago(s.deployedMin),
  },
];

const COUNT_ORDER: ServiceStatus[] = ["good", "warning", "serious", "critical", "stale"];

export interface ServicesCardProps {
  services: Service[];
  query: string;
  filter: ServiceFilter;
  onFilterChange: (filter: ServiceFilter) => void;
  onClear: () => void;
  id?: string;
  className?: string;
}

/**
 * Every service, worst first. Columns drop by the TABLE's width (priority), so
 * the same table reads in a wide board and on a phone. Filtering to nothing
 * shows a designed empty state with the way out.
 */
export function ServicesCard({ services, query, filter, onFilterChange, onClear, id, className }: ServicesCardProps) {
  const needle = query.trim().toLowerCase();
  const rows = services.filter(
    (s) =>
      (filter === "all" || s.status !== "good") &&
      (!needle || s.name.includes(needle) || s.owner.toLowerCase().includes(needle)),
  );
  const counts = COUNT_ORDER.map((status) => ({ status, n: services.filter((s) => s.status === status).length })).filter(
    (c) => c.n > 0,
  );

  return (
    <Card id={id} className={className} data-dashboard-services="">
      <Card.Header>
        <Card.Title as="h2">Services</Card.Title>
        <Card.Description>
          <Inline as="span" gap="r3" rowGap="r6">
            {counts.map(({ status, n }) => (
              <StatusLabel key={status} tone={STATUS[status].tone} className="text-body-3">
                {formatNumber(n)} {STATUS[status].label.toLowerCase()}
              </StatusLabel>
            ))}
          </Inline>
        </Card.Description>
        <Card.Actions>
          <SegmentedControl
            aria-label="Show services"
            value={filter}
            onValueChange={(v) => onFilterChange(v as ServiceFilter)}
          >
            <SegmentedControl.Item value="all">All</SegmentedControl.Item>
            <SegmentedControl.Item value="attention">Needs attention</SegmentedControl.Item>
          </SegmentedControl>
        </Card.Actions>
      </Card.Header>
      <DataTable
        aria-label="Services"
        variant="rules"
        columns={COLUMNS}
        rows={rows}
        getRowKey={(s) => s.name}
        defaultSort={{ column: "status", direction: "desc" }}
        empty={
          <EmptyState
            icon={<SearchX />}
            title={needle ? `No services match “${query.trim()}”` : "Every service is healthy"}
            description={
              needle ? "Search looks at service names and owning teams." : "Nothing needs attention in this range."
            }
            actions={
              <Button variant="secondary" onClick={onClear}>
                {needle ? "Clear search" : "Show all services"}
              </Button>
            }
          />
        }
      />
    </Card>
  );
}
