import { BarChart, LineChart } from "../../../src/components/charts";
import { Inline, Stack } from "../../../src/components/layout";
import { Tabs } from "../../../src/components/navigation";
import { Card } from "../../../src/components/primitives";
import { formatCompact, formatNumber } from "../../../src/util/format";
import type { DashboardData, Range } from "./data";
import { RANGE_LABEL } from "./format";

const wholeNumber = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });

/**
 * Traffic and errors over the selected range, on real axes: requests per second
 * by region as lines (an area when one region is filtered in), error responses
 * by class as stacked columns. Each entity keeps its series slot, so filtering
 * to one region never repaints it. Above each chart, the total's now / peak /
 * low as text.
 */
export function TrafficCard({ data, range, className }: { data: DashboardData; range: Range; className?: string }) {
  const { span, step } = RANGE_LABEL[range];
  const x = data.times.map((t) => new Date(t));
  const single = data.traffic.length === 1;
  return (
    <Card className={className} data-dashboard-traffic="">
      <Card.Header>
        <Card.Title as="h2">Traffic</Card.Title>
        <Card.Description>
          {span}, {step}
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Tabs defaultValue="requests">
          <Tabs.List aria-label="Traffic metric">
            <Tabs.Tab value="requests">Requests</Tabs.Tab>
            <Tabs.Tab value="errors">Error responses</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="requests">
            <Stack gap="r3">
              <Readout values={total(data.traffic)} unit="req/s" format={wholeNumber} />
              <LineChart
                label={`Requests per second by region, ${span.toLowerCase()}`}
                x={x}
                series={data.traffic}
                unit="req/s"
                format={(v) => `${wholeNumber(v)} req/s`}
                area={single}
              />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="errors">
            <Stack gap="r3">
              <Readout values={total(data.errors)} unit="errors" format={(v) => formatCompact(v)} />
              <BarChart
                label={`Error responses by class, ${span.toLowerCase()}`}
                x={x}
                series={data.errors}
                stacked
                format={wholeNumber}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card.Body>
    </Card>
  );
}

function total(series: DashboardData["traffic"]): number[] {
  return series[0]?.values.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)) ?? [];
}

function Readout({ values, unit, format }: { values: number[]; unit: string; format: (v: number) => string }) {
  const facts = [
    ["Now", values[values.length - 1]],
    ["Peak", Math.max(...values)],
    ["Low", Math.min(...values)],
  ] as const;
  return (
    <Inline as="dl" gap="r2" rowGap="r5">
      {facts.map(([term, value]) => (
        <Inline key={term} gap="r5" align="baseline" wrap={false}>
          <dt className="text-body-2 text-fg-secondary">{term}</dt>
          <dd className="text-h4 tabular-nums">
            {format(value ?? Number.NaN)} <span className="text-body-3 font-normal text-fg-muted">{unit}</span>
          </dd>
        </Inline>
      ))}
    </Inline>
  );
}
