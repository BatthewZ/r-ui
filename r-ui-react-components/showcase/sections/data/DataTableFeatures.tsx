import { Ellipsis, RefreshCw, RotateCcw, Trash2, VolumeX } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableFilters,
  DescriptionList,
  IconButton,
  Meter,
  type RowKey,
  SegmentedControl,
  Select,
  StatusLabel,
} from "../../../src";
import { formatNumber, formatPercent } from "../../../src/util/format";
import { ago, type FleetService, makeServices, STATUS_LABEL, STATUS_RANK, type ServiceStatus, TEAMS } from "./fixtures";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "DataTable features",
  group: "data",
  order: 21,
  description:
    "Expandable detail rows, a columns menu, resizable columns (drag, or focus a header's edge and use the arrows), a bulk-action bar, column filters, pages and a sticky first column: all together on one services table (state switcher, right to left), then each alone.",
};

const FLEET = makeServices(48);

/** Wider than most frames, so the table scrolls sideways and the pinned column has work to do. */
const WIDE = "min-w-[calc(var(--COLUMN-LG)*3)]";

const P95_FLOORS = [
  { value: "100", label: "≥ 100 ms" },
  { value: "500", label: "≥ 500 ms" },
  { value: "1000", label: "≥ 1 s" },
];

const COLUMNS: DataTableColumn<FleetService>[] = [
  {
    id: "name",
    header: "Service",
    label: "Service",
    // A starting width: a drag or the arrows still resize it, within its min and max.
    width: "var(--COLUMN-SM)",
    required: true,
    value: (s) => s.name,
    title: (s) => `${s.name} (${s.owner})`,
    filter: { type: "text", placeholder: "Name" },
    cell: (s) => <span className="font-semibold">{s.name}</span>,
  },
  {
    id: "owner",
    header: "Team",
    value: (s) => s.owner,
    filter: { type: "select", options: TEAMS.map((t) => ({ value: t, label: t })) },
  },
  {
    id: "status",
    header: "Status",
    value: (s) => STATUS_RANK[s.status],
    firstDirection: "desc",
    truncate: false,
    title: (s) => STATUS_LABEL[s.status],
    filter: {
      type: "select",
      options: (Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
      match: (row, value) => row.status === value,
    },
    cell: (s) => <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>,
  },
  { id: "rps", header: "Req/s", value: (s) => s.rps, numeric: true, priority: 3 },
  {
    id: "p95",
    header: "p95 ms",
    value: (s) => s.p95,
    numeric: true,
    filter: {
      type: "custom",
      match: (row, value) => (row.p95 ?? -1) >= Number(value),
      render: ({ value, onValueChange, label }) => (
        <Select aria-label={label} value={typeof value === "string" ? value : ""} onValueChange={onValueChange}>
          <option value="">Any</option>
          {P95_FLOORS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ),
    },
  },
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
  { id: "region", header: "Region", value: (s) => s.region, truncate: false, priority: 5 },
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

/** The same columns without filters, for the demos about something else. */
const PLAIN = COLUMNS.map(({ filter: _filter, ...c }) => c);
const NARROW = PLAIN.filter((c) => ["name", "owner", "status", "p95"].includes(c.id));

function Detail({ s }: { s: FleetService }) {
  return (
    <DescriptionList className="max-w-measure">
      <DescriptionList.Item term="Owner">{s.owner}</DescriptionList.Item>
      <DescriptionList.Item term="Region">{s.region}</DescriptionList.Item>
      <DescriptionList.Item term="Version">
        <span className="font-mono">{s.version}</span>
      </DescriptionList.Item>
      <DescriptionList.Item term="Instances">{formatNumber(s.instances)}</DescriptionList.Item>
      <DescriptionList.Item term="Last deploy">{ago(s.deployedMinutesAgo)}</DescriptionList.Item>
    </DescriptionList>
  );
}

const rowActions = (s: FleetService) => (
  <IconButton variant="ghost" label={`Actions for ${s.name}`} icon={<Ellipsis aria-hidden className="size-icon" />} />
);

type Mode = "rows" | "loading" | "empty" | "error";

/** Every feature at once, on a fleet the bulk bar can act on. */
function Everything({ testId, title }: { testId: string; title: string }) {
  const [fleet, setFleet] = useState(FLEET);
  const [mode, setMode] = useState<Mode>("rows");
  const [selected, setSelected] = useState<ReadonlySet<RowKey>>(new Set());
  const [note, setNote] = useState("");
  const act = (verb: string, keys: ReadonlySet<RowKey>) => setNote(`${verb} ${keys.size} service${keys.size === 1 ? "" : "s"}.`);
  return (
    <>
      <SegmentedControl aria-label={`${title}: state`} value={mode} onValueChange={(v) => setMode(v as Mode)} className="self-start">
        {(["rows", "loading", "empty", "error"] as const).map((m) => (
          <SegmentedControl.Item key={m} value={m}>
            {m}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
      <DataTable
        data-sc-scrolls
        data-testid={testId}
        aria-label={title}
        className="max-h-[calc(var(--ROW-H)*14)]"
        classNames={{ table: WIDE }}
        stickyHeader
        columns={COLUMNS}
        rows={mode === "empty" ? [] : fleet}
        getRowKey={(s) => s.id}
        getRowLabel={(s) => `Select ${s.name}`}
        loading={mode === "loading"}
        error={mode === "error" ? "Couldn't load services" : undefined}
        errorActions={
          <Button variant="secondary" iconStart={<RefreshCw aria-hidden className="size-icon" />} onClick={() => setMode("rows")}>
            Retry
          </Button>
        }
        defaultSort={{ column: "status", direction: "desc" }}
        selectable
        selectedKeys={selected}
        onSelectedKeysChange={setSelected}
        rowActions={rowActions}
        renderDetail={(s) => <Detail s={s} />}
        columnsMenu
        resizableColumns
        stickyColumns={1}
        defaultPageSize={10}
        bulkActions={(keys) => (
          <>
            <Button variant="secondary" iconStart={<RotateCcw aria-hidden className="size-icon" />} onClick={() => act("Restarted", keys)}>
              Restart
            </Button>
            <Button variant="ghost" iconStart={<VolumeX aria-hidden className="size-icon" />} onClick={() => act("Silenced", keys)}>
              Silence
            </Button>
            <Button
              variant="danger"
              iconStart={<Trash2 aria-hidden className="size-icon" />}
              onClick={() => {
                act("Removed", keys);
                setFleet((list) => list.filter((s) => !keys.has(s.id)));
                setSelected(new Set());
              }}
            >
              Remove
            </Button>
          </>
        )}
      />
      <p className="text-body-3 text-fg-muted">{note || `${formatNumber(fleet.length)} services.`}</p>
    </>
  );
}

function Expandable() {
  return (
    <DataTable
      data-sc-scrolls
      data-testid="dt-expand"
      aria-label="Services with details"
      variant="rules"
      columns={NARROW}
      rows={FLEET.slice(0, 5)}
      getRowKey={(s) => s.id}
      renderDetail={(s) => <Detail s={s} />}
      defaultExpandedKeys={new Set<RowKey>(["checkout"])}
    />
  );
}

function Columns() {
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set(["name", "status", "p95", "errors"]));
  return (
    <>
      <DataTable
        data-sc-scrolls
        data-testid="dt-columns"
        aria-label="Services, choose columns"
        columns={PLAIN}
        rows={FLEET.slice(0, 5)}
        getRowKey={(s) => s.id}
        columnsMenu
        visibleColumns={shown}
        onVisibleColumnsChange={setShown}
      />
      <p className="text-body-3 text-fg-muted">Shown: {[...shown].join(", ")} (Service is required)</p>
    </>
  );
}

function Resizable() {
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  return (
    <>
      <DataTable
        data-sc-scrolls
        data-testid="dt-resize"
        aria-label="Services, resizable"
        columns={NARROW}
        rows={FLEET.slice(0, 5)}
        getRowKey={(s) => s.id}
        resizableColumns
        columnWidths={widths}
        onColumnWidthsChange={setWidths}
      />
      <p className="text-body-3 text-fg-muted">
        Widths:{" "}
        {Object.keys(widths).length === 0
          ? "automatic (double-click an edge to reset one)"
          : Object.entries(widths)
              .map(([id, px]) => `${id} ${formatNumber(px)} px`)
              .join(", ")}
      </p>
    </>
  );
}

function Bulk() {
  return (
    <DataTable
      data-sc-scrolls
      data-testid="dt-bulk"
      aria-label="Services, bulk actions"
      columns={NARROW}
      rows={FLEET.slice(0, 6)}
      getRowKey={(s) => s.id}
      getRowLabel={(s) => `Select ${s.name}`}
      selectable
      bulkActions={() => (
        <Button variant="secondary" iconStart={<RotateCcw aria-hidden className="size-icon" />}>
          Restart
        </Button>
      )}
    />
  );
}

function Filters() {
  const [filters, setFilters] = useState<DataTableFilters>({ status: "success" });
  return (
    <>
      <DataTable
        data-sc-scrolls
        data-testid="dt-filters"
        aria-label="Services, filtered"
        columns={COLUMNS.filter((c) => ["name", "owner", "status", "p95"].includes(c.id))}
        rows={FLEET.slice(0, 16)}
        getRowKey={(s) => s.id}
        filters={filters}
        onFiltersChange={setFilters}
      />
      <p className="text-body-3 text-fg-muted">Filters: {JSON.stringify(filters)}</p>
    </>
  );
}

function Paged() {
  return (
    <DataTable
      data-sc-scrolls
      data-testid="dt-pages"
      aria-label="Services, paged"
      columns={NARROW}
      rows={FLEET}
      getRowKey={(s) => s.id}
      defaultPageSize={5}
      pageSizeOptions={[5, 10, 25]}
    />
  );
}

function Sticky() {
  return (
    <div className="max-w-measure">
      <DataTable
        data-sc-scrolls
        data-testid="dt-sticky"
        aria-label="Services, first column pinned"
        classNames={{ table: WIDE }}
        columns={PLAIN}
        rows={FLEET.slice(0, 6)}
        getRowKey={(s) => s.id}
        getRowLabel={(s) => `Select ${s.name}`}
        selectable
        striped
        stickyColumns={1}
        defaultSelectedKeys={new Set<RowKey>(["checkout"])}
      />
    </div>
  );
}

export default function DataTableFeaturesSection() {
  return (
    <div className="flex flex-col gap-r1">
      <Demo title="Everything together: detail rows, columns menu, resize, filters, pages, a pinned first column and a bulk bar (Remove takes rows away)">
        <Everything testId="dt-all" title="Services" />
      </Demo>
      <Demo title="Right to left: pinned to the right edge, arrows and drag mirrored">
        <div dir="rtl" className="flex min-w-0 flex-col gap-r4">
          <Everything testId="dt-all-rtl" title="Services (right to left)" />
        </div>
      </Demo>
      <Demo title="Compact">
        <div data-density="compact" className="flex min-w-0 flex-col gap-r4">
          <Everything testId="dt-all-compact" title="Services (compact)" />
        </div>
      </Demo>
      <Demo title="Expandable detail rows (one open to start)">
        <Expandable />
      </Demo>
      <Demo title="Columns menu, controlled">
        <Columns />
      </Demo>
      <Demo title="Resizable columns, controlled widths">
        <Resizable />
      </Demo>
      <Demo title="Bulk-action bar">
        <Bulk />
      </Demo>
      <Demo title="Column filters: text, select and a custom control, controlled (starts on Healthy)">
        <Filters />
      </Demo>
      <Demo title="Pages of five">
        <Paged />
      </Demo>
      <Demo title="Pinned first column in a narrow frame (scroll it sideways)">
        <Sticky />
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <DemoLabel>{title}</DemoLabel>
      {children}
    </div>
  );
}

