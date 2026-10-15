import { Sparkline } from "../../../src/components/data";
import { Grid, Inline, Stack } from "../../../src/components/layout";
import { Tabs } from "../../../src/components/navigation";
import { Card } from "../../../src/components/primitives";
import { formatCompact, formatNumber } from "../../../src/util/format";
import type { DashboardData, Range, Series } from "./data";
import { RANGE_LABEL } from "./format";

interface Metric {
  /** What one point is ("req/s"), for the readout and the spoken summary. */
  unit: string;
  /** "Requests per second", for the charts' accessible names. */
  noun: string;
  series: Series[];
}

/**
 * Traffic and errors over the selected range. The library ships no axis chart
 * in this release, so each tab is a Sparkline at chart height for the total
 * (in ink: an aggregate is not one of the series) with its low / peak / latest
 * as text, then small multiples, one per entity, in that entity's fixed
 * series colour. Honest about scale: every chart is labelled with its range.
 */
export function TrafficCard({ data, range, className }: { data: DashboardData; range: Range; className?: string }) {
  const { span, step } = RANGE_LABEL[range];
  return (
    <Card className={className}>
      <Card.Header>
        <Card.Title as="h2">
          Traffic
        </Card.Title>
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
            <MetricPanel
              span={span}
              metric={{ unit: "req/s", noun: "Requests per second", series: data.traffic }}
              format={(v) => formatNumber(v, { maximumFractionDigits: 0 })}
            />
          </Tabs.Panel>
          <Tabs.Panel value="errors">
            <MetricPanel
              span={span}
              metric={{ unit: "errors", noun: "Error responses per interval", series: data.errors }}
              format={(v) => formatCompact(v)}
            />
          </Tabs.Panel>
        </Tabs>
      </Card.Body>
    </Card>
  );
}

function MetricPanel({ metric, span, format }: { metric: Metric; span: string; format: (v: number) => string }) {
  const { series, unit, noun } = metric;
  const single = series.length === 1 ? series[0] : undefined;
  const total = single
    ? single.values
    : (series[0]?.values.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)) ?? []);
  const name = single ? single.name : "All";

  return (
    <Stack gap="r2">
      <Stack gap="r4">
        <Readout values={total} unit={unit} format={format} />
        <Sparkline
          label={`${noun}, ${name}, ${span.toLowerCase()}`}
          values={total}
          format={format}
          series={single?.slot ?? "total"}
          className="h-chart"
        />
        <Inline justify="between" className="text-body-3 text-fg-muted">
          <span>{span}</span>
          <span>Now</span>
        </Inline>
      </Stack>
      {!single && (
        <Grid as="ul" aria-label={`${noun} by ${series.length === 4 ? "region" : "class"}`} columns={{ base: 2, "@xl": 4 }} gap="r3">
          {series.map((s) => (
            <Stack as="li" key={s.name} gap="r5" className="min-w-0">
              <Inline justify="between" gap="r5" wrap={false} className="text-body-2">
                <span className="truncate text-fg-secondary">{s.name}</span>
                <span className="font-medium tabular-nums">{format(s.values[s.values.length - 1] ?? Number.NaN)}</span>
              </Inline>
              <Sparkline label={`${noun}, ${s.name}, ${span.toLowerCase()}`} values={s.values} series={s.slot} format={format} />
            </Stack>
          ))}
        </Grid>
      )}
    </Stack>
  );
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
