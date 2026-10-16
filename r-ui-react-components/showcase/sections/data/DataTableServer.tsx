import { RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableFilters,
  type SortState,
  StatusLabel,
  Switch,
} from "../../../src";
import { formatNumber } from "../../../src/util/format";
import { type FleetService, makeServices, STATUS_LABEL, STATUS_RANK, type ServiceStatus, TEAMS } from "./fixtures";

export const meta = {
  title: "DataTable on a server",
  group: "data",
  order: 22,
  description:
    "Server mode: `manualSorting`, `manualFiltering` and `manualPagination` with `rowCount`. Every sort, filter, page and page size is a request answered after a simulated delay; the table reports the state and shows exactly the rows it is given. While the server fails, the error state shows with Retry.",
};

/** The "server's" table. */
const DB = makeServices(240);
const LATENCY_MS = 700;

interface Query {
  sort: SortState;
  filters: DataTableFilters;
  page: number;
  pageSize: number;
}

/** What a server would do with the query: filter, sort, cut a page. */
function answer({ sort, filters, page, pageSize }: Query): { rows: FleetService[]; total: number } {
  const name = typeof filters.name === "string" ? filters.name.trim().toLowerCase() : "";
  const owner = typeof filters.owner === "string" ? filters.owner : "";
  const status = typeof filters.status === "string" ? filters.status : "";
  let rows = DB.filter(
    (s) => (!name || s.name.toLowerCase().includes(name)) && (!owner || s.owner === owner) && (!status || s.status === status),
  );
  if (sort) {
    const key = (s: FleetService): number | string =>
      sort.column === "status" ? STATUS_RANK[s.status] : sort.column === "p95" ? (s.p95 ?? -1) : s.name;
    const sign = sort.direction === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
  }
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
}

const COLUMNS: DataTableColumn<FleetService>[] = [
  { id: "name", header: "Service", value: (s) => s.name, filter: { type: "text", placeholder: "Name" } },
  {
    id: "owner",
    header: "Team",
    value: (s) => s.owner,
    sortable: false,
    filter: { type: "select", options: TEAMS.map((t) => ({ value: t, label: t })) },
  },
  {
    id: "status",
    header: "Status",
    value: (s) => STATUS_RANK[s.status],
    firstDirection: "desc",
    truncate: false,
    filter: {
      type: "select",
      options: (Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    },
    cell: (s) => <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>,
  },
  { id: "p95", header: "p95 ms", value: (s) => s.p95, numeric: true },
];

export default function DataTableServerSection() {
  const [query, setQuery] = useState<Query>({ sort: null, filters: {}, page: 1, pageSize: 10 });
  const [result, setResult] = useState<{ rows: FleetService[]; total: number } | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const [failing, setFailing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setPending(true);
    const timer = setTimeout(() => {
      if (!current) return;
      setPending(false);
      setFailed(failing);
      if (!failing) setResult(answer(query));
    }, LATENCY_MS);
    // A newer query wins: an older answer that lands later is dropped.
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, attempt, failing]);

  const set = (patch: Partial<Query>) => setQuery((q) => ({ ...q, ...patch }));

  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <Switch checked={failing} onCheckedChange={setFailing}>
        The server fails every request
      </Switch>
      <DataTable
        data-sc-scrolls
        data-testid="dt-server"
        aria-label="Services (server)"
        columns={COLUMNS}
        rows={result?.rows ?? []}
        getRowKey={(s) => s.id}
        manualSorting
        manualFiltering
        manualPagination
        rowCount={result?.total ?? 0}
        loading={pending}
        loadingRows={query.pageSize}
        error={failed ? "The services API did not answer" : undefined}
        errorActions={
          <Button variant="secondary" iconStart={<RefreshCw aria-hidden className="size-icon" />} onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        }
        sort={query.sort}
        // The table asks for page 1 itself when the sort or a filter changes.
        onSortChange={(sort) => set({ sort })}
        filters={query.filters}
        onFiltersChange={(filters) => set({ filters })}
        page={query.page}
        onPageChange={(page) => set({ page })}
        pageSize={query.pageSize}
        onPageSizeChange={(pageSize) => set({ pageSize })}
      />
      <Echo>
        Request: sort {query.sort ? `${query.sort.column} ${query.sort.direction}` : "none"} · filters{" "}
        {JSON.stringify(query.filters)} · page {formatNumber(query.page)} of size {formatNumber(query.pageSize)}
        {pending ? " · waiting…" : ""}
      </Echo>
    </div>
  );
}

function Echo({ children }: { children: ReactNode }) {
  return <p className="text-body-3 text-fg-muted">{children}</p>;
}
