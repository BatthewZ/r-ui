import { useMemo, useRef, useState } from "react";

import { type DataTableColumn, VirtualizedTable } from "../../../src/components/data";
import { SegmentedControl } from "../../../src/components/form";
import { Button, StatusLabel } from "../../../src/components/primitives";
import { formatBytes, formatNumber } from "../../../src/util/format";
import { makeRequests, type Request } from "../../sections/data/fixtures";
import { TokenReadout } from "./parts";

const ROWS = 10_000;

/** A column `n` characters wide plus the cell's inline padding (widths are border-box). */
const w = (n: number) => `calc(${n}ch + var(--R-SIZE-3) * 2)`;

const COLUMNS: DataTableColumn<Request>[] = [
  { id: "id", header: "#", value: (r) => r.id, numeric: true, width: w(6) },
  { id: "method", header: "Method", value: (r) => r.method, width: w(8), priority: 2 },
  { id: "path", header: "Path", value: (r) => r.path },
  {
    id: "status",
    header: "Status",
    value: (r) => r.status,
    numeric: true,
    width: w(8),
    cell: (r) => (
      <StatusLabel tone={r.status >= 500 ? "error" : r.status >= 400 ? "warning" : "success"}>{r.status}</StatusLabel>
    ),
    title: (r) => String(r.status),
  },
  { id: "ms", header: "ms", value: (r) => r.ms, numeric: true, width: w(6), priority: 3 },
  { id: "bytes", header: "Size", value: (r) => r.bytes, numeric: true, width: w(9), priority: 4, cell: (r) => formatBytes(r.bytes) },
];

type Density = "comfortable" | "compact";

/**
 * 10,000 rows under a density boundary of their own. Flipping it while
 * scrolled deep is the hard case: the row height changes under a fixed
 * scrollTop, so the window must be recomputed from the new height at once.
 */
export function VirtualPanel() {
  const rows = useMemo(() => makeRequests(ROWS), []);
  const [density, setDensity] = useState<Density>("comfortable");
  const area = useRef<HTMLDivElement>(null);
  const jump = () => {
    const el = area.current;
    if (el) el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  };
  return (
    <div className="flex min-w-0 flex-col gap-r3">
      <div className="flex flex-wrap items-center gap-r3">
        <SegmentedControl
          aria-label="Table density"
          value={density}
          onValueChange={(v) => setDensity(v === "compact" ? "compact" : "comfortable")}
        >
          <SegmentedControl.Item value="comfortable">Comfortable</SegmentedControl.Item>
          <SegmentedControl.Item value="compact">Compact</SegmentedControl.Item>
        </SegmentedControl>
        <Button variant="secondary" onClick={jump}>
          Jump to the middle
        </Button>
      </div>
      <div data-density={density} data-testid="stress-virtual-scope" className="flex min-w-0 flex-col gap-r4">
        <p className="text-body-3 text-fg-muted">
          {formatNumber(ROWS)} requests · <TokenReadout className="font-mono" />
        </p>
        <VirtualizedTable
          ref={area}
          data-testid="stress-virtual"
          aria-label="Requests (stress)"
          visibleRows={10}
          columns={COLUMNS}
          rows={rows}
          getRowKey={(r) => r.id}
        />
      </div>
    </div>
  );
}
