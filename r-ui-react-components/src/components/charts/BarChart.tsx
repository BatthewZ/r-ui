"use client";
import { useMemo, useRef } from "react";

import { useLabels, useLocale } from "../../util/locale";
import { cn } from "../../util/style";
import {
  type ChartSeries,
  type ChartX,
  drawnSeries,
  makeFormatters,
  modelCartesian,
  type ValueFormatOptions,
} from "./chart-model";
import { CartesianAxes } from "./chart-axes";
import {
  cartesianFrameProps,
  type ChartBaseProps,
  ChartFrame,
  ChartLegend,
  ChartReadout,
  DEFAULT_CHART_LABELS,
  PlotRegion,
  readoutStatus,
  SERIES_TEXT,
  seriesReadout,
  useAxisCursor,
} from "./chart-parts";
import { type BarOrientation, planBars } from "./chart-plan";
import type { TimeZoneMode } from "./chart-scale";
import { useChartBox } from "./use-chart-box";

export interface BarChartProps extends ChartBaseProps, ValueFormatOptions {
  /**
   * One category per bar group, shared by every series. Dates make a time band
   * axis (labels on calendar boundaries); anything else is a category label.
   * Omitted: the groups are numbered.
   */
  x?: readonly ChartX[];
  /** Up to eight are drawn (one series colour and shape each); the table lists up to 24. */
  series: readonly ChartSeries[];
  /** `vertical` columns rise from the x axis; `horizontal` bars run from a category gutter. @default "vertical" */
  orientation?: BarOrientation;
  /** Stack the series in one bar per category (positive up, negative down) instead of grouping them. */
  stacked?: boolean;
  /** The calendar time labels are read in. @default "local" */
  timeZone?: TimeZoneMode;
  /** Pins the value axis's lower end (it always holds zero otherwise). */
  min?: number;
  /** Pins the value axis's upper end. */
  max?: number;
}

/**
 * Columns or bars, grouped or stacked, from one baseline at zero: thickness from
 * `--BAR-THICK` (shrunk only when a band cannot hold it), a rounded data end and
 * a square base, a surface gap between touching bars. Vertical charts are
 * `h-chart` tall; horizontal ones grow with their category count.
 *
 * The same axis, legend, table and readout as `LineChart`: the band under the
 * pointer is washed and one tooltip lists every series in it (and the total,
 * when stacked); the plot takes focus and arrows step through the bands.
 * Horizontal, unstacked bars carry their value at the tip.
 */
export function BarChart({
  label,
  summary,
  x,
  series,
  orientation = "vertical",
  stacked = false,
  timeZone,
  min,
  max,
  unit,
  format,
  formatTick,
  locale: localeProp,
  labels,
  className,
  classNames,
  ref,
  ...rest
}: BarChartProps) {
  const words = useLabels("Chart", DEFAULT_CHART_LABELS, labels);
  const locale = useLocale(localeProp);
  const horizontal = orientation === "horizontal";
  const formatters = useMemo(() => makeFormatters({ unit, format, formatTick, locale }), [unit, format, formatTick, locale]);
  // Bars sit in bands: a time x is a band axis, so it keeps its order and labels, never a scale.
  const model = useMemo(() => {
    const m = modelCartesian({ x, series, timeZone, locale });
    return m.xType === "number" ? modelCartesian({ x, series, timeZone, locale, xType: "category" }) : m;
  }, [x, series, timeZone, locale]);
  const plotRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const box = useChartBox(plotRef, probeRef);
  const plan = useMemo(
    () => planBars(model, box, { orientation, stacked, min, max, formatters, barThick: box.barThick, radius: box.radius }),
    [model, box, orientation, stacked, min, max, formatters],
  );

  const { active, source, handlers } = useAxisCursor({
    order: plan?.order ?? [],
    rowPos: plan?.rowPos ?? [],
    axis: horizontal ? "y" : "x",
    root: plotRef,
  });
  const row = active === null ? undefined : model.rows[active];
  const band = active === null ? undefined : plan?.bands.find((b) => b.row === active);
  const drawn = drawnSeries(model.series);
  const readout = seriesReadout(row, drawn, formatters);
  if (row && stacked && drawn.length > 1) {
    const values = drawn.map((s) => row.values[s.index] ?? null).filter((v): v is number => v !== null);
    readout.push({ name: words.total, value: formatters.value(values.length ? values.reduce((a, b) => a + b, 0) : null), slot: null, shape: null });
  }
  const status = row ? readoutStatus(row.label, readout, source) : "";

  const anchor =
    plan && band
      ? horizontal
        ? { x: plan.plot.left, y: band.start, w: plan.plot.right - plan.plot.left, h: band.size }
        : { x: band.start, y: plan.plot.top, w: band.size, h: plan.plot.bottom - plan.plot.top }
      : null;

  return (
    <ChartFrame
      kind="bar"
      label={label}
      {...cartesianFrameProps(model, formatters, words, summary, stacked ? "stackedBar" : "bar")}
      legend={<ChartLegend line={false} className={classNames?.legend} entries={drawn} />}
      status={status}
      className={className}
      classNames={classNames}
      ref={ref}
      {...rest}
    >
      <PlotRegion
        ref={plotRef}
        probeRef={probeRef}
        label={label}
        hint={words.keyboardHint}
        className={cn(horizontal ? "w-full" : "h-chart w-full", classNames?.plot)}
        style={horizontal ? { height: plan?.height ?? 0 } : undefined}
        {...handlers}
      >
        {plan && (
          <svg aria-hidden width={plan.width} height={plan.height} className="r-charts-svg absolute inset-0 block">
            {band && (
              <rect
                data-chart-band=""
                data-row={band.row}
                className="r-charts-band"
                {...(horizontal
                  ? { x: plan.plot.left, y: band.start, width: plan.plot.right - plan.plot.left, height: band.size }
                  : { x: band.start, y: plan.plot.top, width: band.size, height: plan.plot.bottom - plan.plot.top })}
              />
            )}
            <CartesianAxes
              plot={plan.plot}
              valueTicks={plan.valueTicks}
              categoryLabels={plan.categoryLabels}
              zero={horizontal ? (plan.zero > plan.plot.left ? plan.zero : null) : plan.zero < plan.plot.bottom ? plan.zero : null}
              orientation={horizontal ? "horizontal" : "vertical"}
              fontSize={box.fontSize}
            />
            {drawn.map((s) => (
              <g key={s.index} data-series={s.index} className={cn("r-charts-series", SERIES_TEXT[s.slot])}>
                {plan.bars
                  .filter((b) => b.series === s.index)
                  .map((b) => (
                    <path key={b.row} d={b.d} className="r-charts-bar" />
                  ))}
              </g>
            ))}
            {plan.values.length > 0 && (
              <g className="r-charts-value fill-fg-secondary">
                {plan.values.map((v, i) => (
                  <text key={i} x={v.x} y={v.y} textAnchor={v.anchor} dominantBaseline="central">
                    {v.text}
                  </text>
                ))}
              </g>
            )}
          </svg>
        )}
        {plan && (
          <ChartReadout
            line={false}
            open={row !== undefined}
            anchor={anchor}
            placement={horizontal ? "top" : "right-start"}
            title={row?.label ?? ""}
            rows={readout}
            className={classNames?.tooltip}
          />
        )}
      </PlotRegion>
    </ChartFrame>
  );
}
