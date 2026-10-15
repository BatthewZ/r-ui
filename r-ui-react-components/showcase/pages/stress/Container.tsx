import { useEffect, useRef, useState } from "react";

import { Sparkline, StatCard, Table } from "../../../src/components/data";
import { StatusLabel } from "../../../src/components/primitives";
import { SegmentedControl } from "../../../src/components/form";
import { Pagination } from "../../../src/components/navigation";
import { formatNumber, formatPercent } from "../../../src/util/format";
import { cn } from "../../../src/util/style";
import { series, SERVICES, STATUS_LABEL } from "../../sections/data/fixtures";

const PRESETS = {
  sm: "w-column-sm",
  md: "w-column-md",
  lg: "w-column-lg",
  full: "w-full",
} as const;
type Preset = keyof typeof PRESETS;

/**
 * One box, `resize: horizontal`, holding a StatCard, a Table and Pagination.
 * Each adapts to the BOX's width (container queries and `cqi`), so dragging
 * the corner at any viewport width shows the same steps.
 */
export function ContainerPanel() {
  const box = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<Preset>("md");
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry ? Math.round(entry.contentRect.width) : null));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const choose = (value: string) => {
    if (!(value in PRESETS)) return;
    // A drag writes an inline width; a preset takes the box back from it.
    box.current?.style.removeProperty("width");
    setPreset(value as Preset);
  };

  return (
    <div className="flex min-w-0 flex-col gap-r3">
      <div className="flex flex-wrap items-center gap-r3">
        <SegmentedControl aria-label="Box width" value={preset} onValueChange={choose}>
          <SegmentedControl.Item value="sm">Column S</SegmentedControl.Item>
          <SegmentedControl.Item value="md">Column M</SegmentedControl.Item>
          <SegmentedControl.Item value="lg">Column L</SegmentedControl.Item>
          <SegmentedControl.Item value="full">Full</SegmentedControl.Item>
        </SegmentedControl>
        <span className="font-mono text-body-3 text-fg-muted" aria-live="polite">
          box: {formatNumber(width)} CSS pixels · drag the corner
        </span>
      </div>
      <div
        ref={box}
        data-testid="stress-resize-box"
        className={cn(
          "flex max-w-full min-w-0 resize-x flex-col gap-r3 overflow-auto rounded-lg border border-dashed border-border-strong bg-canvas p-r3",
          PRESETS[preset],
        )}
      >
        <StatCard
          label="p95 latency"
          value={formatNumber(212)}
          unit="ms"
          delta={38}
          sentiment="bad"
          deltaLabel="vs prior 24h"
          sparkline={<Sparkline label="p95 latency, 24h" series={2} values={series(2, 24, 180, 40)} />}
        />
        <Table variant="boxed" aria-label="Services (container playground)">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell truncate={false}>Status</Table.HeaderCell>
              <Table.HeaderCell numeric priority={3}>
                Req/s
              </Table.HeaderCell>
              <Table.HeaderCell numeric>p95 ms</Table.HeaderCell>
              <Table.HeaderCell numeric priority={2}>
                Errors
              </Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {SERVICES.slice(0, 5).map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell title={s.name}>{s.name}</Table.Cell>
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
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <Pagination pageCount={24} defaultPage={3} />
      </div>
    </div>
  );
}
