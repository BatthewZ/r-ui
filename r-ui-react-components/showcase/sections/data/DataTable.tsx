import { Ellipsis, RefreshCw, SearchX } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  Meter,
  type RowKey,
  SegmentedControl,
  type SortState,
  StatusLabel,
} from "../../../src";
import { formatPercent } from "../../../src/util/format";
import { ago, type Service, SERVICES, STATUS_LABEL, STATUS_RANK } from "./fixtures";

export const meta = {
  title: "DataTable",
  group: "data",
  order: 20,
  description:
    "Column-driven table: sorting (numeric columns start descending, missing values sort last), selection with an indeterminate select-all, row actions, and loading / empty / error states under the same head. Controlled selection is echoed below the table.",
};

const COLUMNS: DataTableColumn<Service>[] = [
  {
    id: "name",
    header: "Service",
    value: (s) => s.name,
    title: (s) => `${s.name} (${s.owner})`,
    cell: (s) => (
      <>
        <span className="font-semibold">{s.name}</span>
        <span className="ms-r4 text-fg-muted">{s.owner}</span>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    value: (s) => STATUS_RANK[s.status],
    firstDirection: "desc",
    truncate: false,
    title: (s) => STATUS_LABEL[s.status],
    cell: (s) => <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>,
  },
  { id: "rps", header: "Req/s", value: (s) => s.rps, numeric: true, priority: 3 },
  { id: "p95", header: "p95 ms", value: (s) => s.p95, numeric: true },
  {
    id: "errors",
    header: "Errors",
    value: (s) => s.errorRate,
    numeric: true,
    priority: 2,
    cell: (s) => formatPercent(s.errorRate, { maximumFractionDigits: 2 }),
  },
  {
    id: "cpu",
    header: "CPU",
    value: (s) => s.cpu,
    numeric: true,
    priority: 4,
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
    value: (s) => s.deployedMinutesAgo,
    numeric: true,
    priority: 5,
    firstDirection: "asc",
    cell: (s) => ago(s.deployedMinutesAgo),
  },
];

type Mode = "rows" | "loading" | "empty" | "error";

export default function DataTableSection() {
  const [mode, setMode] = useState<Mode>("rows");
  const [selected, setSelected] = useState<ReadonlySet<RowKey>>(new Set(["checkout"]));
  const [sort, setSort] = useState<SortState>({ column: "status", direction: "desc" });

  return (
    <div className="flex flex-col gap-r1">
      <Demo title="Controlled sort and selection, row actions">
        <SegmentedControl aria-label="State" value={mode} onValueChange={(v) => setMode(v as Mode)} className="self-start">
          {(["rows", "loading", "empty", "error"] as const).map((m) => (
            <SegmentedControl.Item key={m} value={m}>
              {m}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
        <DataTable
          aria-label="Services"
          columns={COLUMNS}
          rows={mode === "empty" ? [] : SERVICES}
          getRowKey={(s) => s.id}
          getRowLabel={(s) => `Select ${s.name}`}
          sort={sort}
          onSortChange={setSort}
          selectable
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          loading={mode === "loading"}
          error={mode === "error" ? "Couldn't load services" : undefined}
          errorActions={
            <Button variant="secondary" iconStart={<RefreshCw aria-hidden className="size-icon" />}>
              Retry
            </Button>
          }
          empty={
            <EmptyState
              icon={<SearchX />}
              title="No services match"
              description="Nothing in production matches these filters."
              actions={<Button variant="secondary">Clear filters</Button>}
            />
          }
          rowActions={(s) => (
            <IconButton variant="ghost" label={`Actions for ${s.name}`} icon={<Ellipsis aria-hidden className="size-icon" />} />
          )}
        />
        <p className="text-body-3 text-fg-muted" aria-live="polite">
          Selected: {selected.size === 0 ? "none" : [...selected].join(", ")} · Sort:{" "}
          {sort ? `${sort.column} ${sort.direction}` : "none"}
        </p>
      </Demo>

      <Demo title="Uncontrolled, rules chrome, striped, in a narrow column">
        <div className="max-w-measure">
          <DataTable
            aria-label="Services (narrow)"
            variant="rules"
            striped
            columns={COLUMNS}
            rows={SERVICES}
            getRowKey={(s) => s.id}
            selectable
            defaultSort={{ column: "p95", direction: "desc" }}
          />
        </div>
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <p className="text-body-3 font-medium text-fg-muted">{title}</p>
      {children}
    </div>
  );
}
