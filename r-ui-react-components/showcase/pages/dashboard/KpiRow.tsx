import { Sparkline, StatCard } from "../../../src/components/data";
import { Grid } from "../../../src/components/layout";
import { StatusLabel } from "../../../src/components/primitives";
import { formatCompact, formatNumber, formatUnit } from "../../../src/util/format";
import type { DashboardData } from "./data";
import type { DashboardView } from "./filters";
import { percentDelta, pointDelta } from "./format";

const TWO_PLACES = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * Six KPI tiles: 2, 3 or 6 to a row by the BOARD's width. Each tile sizes its
 * own figure (text-kpi, cqi). Sentiment is keyed per metric, never by sign:
 * error rate falling is good, latency and CPU rising are bad, availability
 * holding is neutral. Active users comes from a lagging pipeline: stale.
 */
export function KpiRow({ data, view }: { data: DashboardData; view: DashboardView }) {
  const { kpis } = data;
  const { prior } = view;
  const span = view.phrase;
  const trend = (label: string, values: number[]) => (
    <Sparkline label={`${label}, ${span}`} values={values} summary={`trend over ${span}`} />
  );

  return (
    <Grid as="section" aria-label="Key metrics" columns={{ base: 1, "@sm": 2, "@2xl": 3, "@5xl": 6 }} data-dashboard-kpis="">
      <StatCard
        label="Requests"
        value={formatCompact(kpis.requests.value)}
        delta={kpis.requests.delta}
        formatDelta={percentDelta}
        sentiment="good"
        deltaLabel={prior}
        sparkline={trend("Requests", kpis.requests.trend)}
      />
      <StatCard
        label="Error rate"
        value={formatNumber(kpis.errorRate.value, TWO_PLACES)}
        unit="%"
        delta={kpis.errorRate.delta}
        formatDelta={pointDelta}
        sentiment="good"
        deltaLabel={prior}
        sparkline={trend("Error rate", kpis.errorRate.trend)}
      />
      <StatCard
        label="p95 latency"
        value={formatNumber(kpis.p95.value, { maximumFractionDigits: 0 })}
        unit="ms"
        delta={kpis.p95.delta}
        formatDelta={percentDelta}
        sentiment="bad"
        deltaLabel={prior}
        sparkline={trend("p95 latency", kpis.p95.trend)}
      />
      <StatCard
        label="Availability"
        value={formatNumber(kpis.availability.value, TWO_PLACES)}
        unit="%"
        delta={kpis.availability.delta}
        formatDelta={pointDelta}
        sentiment="neutral"
        deltaLabel={prior}
        status={<StatusLabel tone="success">Within SLO</StatusLabel>}
      />
      <StatCard
        label="Active users"
        value={formatCompact(kpis.users.value)}
        delta={kpis.users.delta}
        formatDelta={percentDelta}
        sentiment="good"
        deltaLabel={prior}
        stale={`${formatUnit(18, "minute")} old`}
        sparkline={trend("Active users", kpis.users.trend)}
      />
      <StatCard
        label="CPU saturation"
        value={formatNumber(kpis.cpu.value, { maximumFractionDigits: 0 })}
        unit="%"
        delta={kpis.cpu.delta}
        formatDelta={pointDelta}
        sentiment="bad"
        deltaLabel={prior}
        sparkline={trend("CPU saturation", kpis.cpu.trend)}
      />
    </Grid>
  );
}
