import { type ReactNode, useMemo, useState } from "react";

import { Meter, type SortDirection, StatusLabel, Table, type TableVariant } from "../../../src";
import { formatNumber, formatPercent } from "../../../src/util/format";
import { ago, type Service, SERVICES, STATUS_LABEL, STATUS_RANK } from "./fixtures";

export const meta = {
  title: "Table",
  group: "data",
  order: 10,
  description:
    "Compound table: --ROW-H rows, one-line cells with the full value in title, numeric columns end-aligned and tabular, sortable headers (aria-sort), a selected row with a leading marker, three chromes, and columns that drop by the TABLE's width. Drag the first demo's corner to resize it.",
};

type Key = "name" | "status" | "rps" | "p95" | "errorRate" | "cpu" | "deployedMinutesAgo";

const value = (s: Service, key: Key): string | number => {
  if (key === "status") return STATUS_RANK[s.status];
  if (key === "name") return s.name;
  return s[key] ?? -1;
};

function ServicesTable({
  variant = "boxed",
  striped,
  stickyHeader,
  className,
  label,
}: {
  variant?: TableVariant;
  striped?: boolean;
  stickyHeader?: boolean;
  className?: string;
  label: string;
}) {
  const [sort, setSort] = useState<{ key: Key; dir: SortDirection }>({ key: "status", dir: "desc" });
  const rows = useMemo(
    () =>
      [...SERVICES].sort((a, b) => {
        const va = value(a, sort.key);
        const vb = value(b, sort.key);
        const c = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : Number(va) - Number(vb);
        return (sort.dir === "asc" ? c : -c) || a.name.localeCompare(b.name);
      }),
    [sort],
  );
  const header = (key: Key, numeric = false) => ({
    sort: sort.key === key ? sort.dir : null,
    onSort: () =>
      setSort((s) => ({ key, dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : numeric || key === "status" ? "desc" : "asc" })),
  });

  return (
    <Table variant={variant} striped={striped} stickyHeader={stickyHeader} className={className} aria-label={label}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell {...header("name")}>Service</Table.HeaderCell>
          <Table.HeaderCell truncate={false} {...header("status")}>
            Status
          </Table.HeaderCell>
          <Table.HeaderCell numeric priority={3} {...header("rps", true)}>
            Req/s
          </Table.HeaderCell>
          <Table.HeaderCell numeric {...header("p95", true)}>
            p95 ms
          </Table.HeaderCell>
          <Table.HeaderCell numeric priority={2} {...header("errorRate", true)}>
            Errors
          </Table.HeaderCell>
          <Table.HeaderCell numeric priority={4} {...header("cpu", true)}>
            CPU
          </Table.HeaderCell>
          <Table.HeaderCell numeric priority={5} {...header("deployedMinutesAgo", true)}>
            Last deploy
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((s) => (
          <Table.Row key={s.id} selected={s.id === "checkout"}>
            <Table.Cell title={`${s.name} (${s.owner})`}>
              <span className="font-semibold">{s.name}</span>
              <span className="ms-r4 text-fg-muted">{s.owner}</span>
            </Table.Cell>
            <Table.Cell truncate={false}>
              <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>
            </Table.Cell>
            <Table.Cell numeric priority={3}>
              {formatNumber(s.rps)}
            </Table.Cell>
            <Table.Cell numeric>{formatNumber(s.p95)}</Table.Cell>
            <Table.Cell numeric priority={2}>
              {formatPercent(s.errorRate, { maximumFractionDigits: 2 })}
            </Table.Cell>
            <Table.Cell numeric priority={4}>
              <Meter
                variant="inline"
                label={`${s.name} CPU`}
                value={s.cpu}
                thresholds={[
                  { at: 80, tone: "warning" },
                  { at: 90, tone: "error" },
                ]}
              />
            </Table.Cell>
            <Table.Cell numeric priority={5}>
              {ago(s.deployedMinutesAgo)}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

export default function TableSection() {
  return (
    <div className="@container flex flex-col gap-r1">
      <Demo title="Boxed, sortable, a selected row; resize to drop columns (Last deploy, CPU, Req/s, Errors)">
        <div className="resize-x overflow-auto">
          <ServicesTable label="Services" />
        </div>
      </Demo>

      <div className="grid grid-cols-1 gap-r2 @4xl:grid-cols-3">
        <Demo title="Rules, in a card">
          <div className="rounded-lg border border-border bg-surface-0 p-r3">
            <ServicesTable variant="rules" label="Services (rules)" />
          </div>
        </Demo>
        <Demo title="Plain, striped">
          <ServicesTable variant="plain" striped label="Services (plain, striped)" />
        </Demo>
        <Demo title="Sticky head, bounded height">
          <ServicesTable stickyHeader className="max-h-[calc(var(--ROW-H)*5)]" label="Services (sticky head)" />
        </Demo>
      </div>

      <Demo title="Caption, missing values, RTL">
        <div dir="rtl" lang="ar">
          <Table variant="rules">
            <Table.Caption>الخدمات (Services)</Table.Caption>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>الخدمة</Table.HeaderCell>
                <Table.HeaderCell numeric sort="desc" onSort={() => undefined}>
                  طلب/ث
                </Table.HeaderCell>
                <Table.HeaderCell numeric>p95</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {SERVICES.slice(0, 4).map((s, i) => (
                <Table.Row key={s.id} selected={i === 1}>
                  <Table.Cell>{s.name}</Table.Cell>
                  <Table.Cell numeric>{formatNumber(i === 2 ? null : s.rps)}</Table.Cell>
                  <Table.Cell numeric>{formatNumber(s.p95)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
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
