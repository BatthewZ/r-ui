import type { ReactNode } from "react";

import { Sparkline, StatCard, StatusLabel } from "../../../src";
import { formatCompact, formatNumber, formatPercent } from "../../../src/util/format";
import { series } from "./fixtures";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "StatCard",
  group: "data",
  order: 40,
  description:
    "KPI tiles. The value is text-kpi, sized by the TILE's width (cqi) between the density's min and max; a roomy tile puts the sparkline beside the value. Delta colour follows sentiment, not direction: error rate DOWN is good. States: stale, loading, missing value, status.",
};

const pct = (d: number) => formatPercent(d / 100, { signDisplay: "exceptZero", maximumFractionDigits: 1 });

export default function StatCardSection() {
  return (
    <div className="@container flex flex-col gap-r1">
      <Demo title="Six tiles: 2, 3 or 6 columns by the board's width">
        <div className="grid grid-cols-2 gap-r3 @xl:grid-cols-3 @5xl:grid-cols-6">
          <StatCard
            label="Requests / s"
            value={formatCompact(18420)}
            delta={12.4}
            formatDelta={pct}
            sentiment="good"
            deltaLabel="vs prior 24h"
            sparkline={<Sparkline label="Requests per second, 24h" values={series(1, 24, 160, 30)} />}
          />
          <StatCard
            label="p95 latency"
            value={formatNumber(212)}
            unit="ms"
            delta={38}
            sentiment="bad"
            deltaLabel="vs prior 24h"
            sparkline={<Sparkline label="p95 latency, 24h" series={2} values={series(2, 24, 180, 40)} />}
          />
          <StatCard
            label="Error rate"
            value={formatPercent(0.0042, { maximumFractionDigits: 2 })}
            delta={-0.8}
            formatDelta={pct}
            sentiment="good"
            deltaLabel="vs prior 24h"
            sparkline={<Sparkline label="Error rate, 24h" series={3} values={series(3, 24, 5, 2)} />}
          />
          <StatCard
            label="Availability"
            value={formatPercent(0.99962, { maximumFractionDigits: 3 })}
            delta={0}
            formatDelta={pct}
            deltaLabel="vs prior 24h"
            status={<StatusLabel tone="success">Within SLO</StatusLabel>}
          />
          <StatCard
            label="Open incidents"
            value={formatNumber(4)}
            delta={2}
            sentiment="bad"
            deltaLabel="since yesterday"
            status={<StatusLabel tone="serious">2 serious</StatusLabel>}
          />
          <StatCard
            label="Queue depth (eu-west)"
            value={formatCompact(1_284_000)}
            delta={-3.1}
            formatDelta={pct}
            sentiment="neutral"
            stale="12 min old"
            sparkline={<Sparkline label="Queue depth, 24h" series={4} values={[...series(4, 18, 90, 20), null, null]} />}
          />
        </div>
      </Demo>

      <Demo title="States: loading, missing value, long label, negative, a narrow and a wide tile">
        <div className="grid grid-cols-1 gap-r3 @xl:grid-cols-[1fr_1fr_2fr]">
          <StatCard label="Revenue (today)" value="" loading />
          <StatCard label="Cost per request" value={null} unit="µ$" deltaLabel="No data in this range" />
          <StatCard
            label="Net change in active subscriptions across every region and plan"
            value={formatNumber(-1_204)}
            delta={-1204}
            sentiment="bad"
            deltaLabel="vs prior 30d"
            sparkline={<Sparkline label="Active subscriptions, 30d" series={5} values={series(5, 30, 900, 120)} />}
          />
        </div>
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
