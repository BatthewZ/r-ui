import { type ReactNode, useMemo } from "react";

import { type DataTableColumn, StatusLabel, VirtualizedTable } from "../../../src";
import { formatBytes, formatNumber } from "../../../src/util/format";
import { makeRequests, type Request } from "./fixtures";

export const meta = {
  title: "VirtualizedTable",
  group: "data",
  order: 30,
  description:
    "10,000 rows, only the visible window mounted. Row height is the real --ROW-H, re-measured when density or input changes (flip them in View), so the scroll height is exactly rows × row height + the head. The second table is a compact subtree.",
};

/** A column `n` characters wide plus the cell's inline padding (widths are border-box). */
const w = (n: number) => `calc(${n}ch + var(--R-SIZE-3) * 2)`;

const COLUMNS: DataTableColumn<Request>[] = [
  { id: "id", header: "#", value: (r) => r.id, numeric: true, width: w(6), priority: 2 },
  { id: "method", header: "Method", value: (r) => r.method, width: w(8), priority: 2 },
  { id: "path", header: "Path", value: (r) => r.path },
  {
    id: "status",
    header: "Status",
    value: (r) => r.status,
    numeric: true,
    width: w(9),
    cell: (r) => (
      <StatusLabel tone={r.status >= 500 ? "error" : r.status >= 400 ? "warning" : "success"}>{r.status}</StatusLabel>
    ),
    title: (r) => String(r.status),
  },
  { id: "ms", header: "ms", value: (r) => r.ms, numeric: true, width: w(6), priority: 2 },
  { id: "bytes", header: "Size", value: (r) => r.bytes, numeric: true, width: w(10), priority: 3, cell: (r) => formatBytes(r.bytes) },
  { id: "region", header: "Region", value: (r) => r.region, width: w(10), priority: 4 },
];

export default function VirtualizedTableSection() {
  const rows = useMemo(() => makeRequests(10_000), []);
  return (
    <div className="flex flex-col gap-r1">
      <Demo title={`${formatNumber(rows.length)} requests, selectable, sortable`}>
        <VirtualizedTable
          data-testid="virtual-requests"
          aria-label="Requests"
          columns={COLUMNS}
          rows={rows}
          getRowKey={(r) => r.id}
          getRowLabel={(r) => `Select request ${r.id}`}
          selectable
        />
      </Demo>
      <Demo title="Compact subtree, rules chrome, 8 visible rows">
        <div data-density="compact">
          <VirtualizedTable
            data-testid="virtual-compact"
            aria-label="Requests (compact)"
            variant="rules"
            visibleRows={8}
            columns={COLUMNS}
            rows={rows}
            getRowKey={(r) => r.id}
            defaultSort={{ column: "ms", direction: "desc" }}
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
