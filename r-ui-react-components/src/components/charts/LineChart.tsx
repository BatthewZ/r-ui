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
  type XScaleType,
} from "./chart-model";
import {
  cartesianFrameProps,
  type ChartBaseProps,
  ChartFrame,
  ChartLegend,
  ChartReadout,
  DEFAULT_CHART_LABELS,
  Mark,
  PlotRegion,
  readoutStatus,
  SERIES_TEXT,
  seriesReadout,
  useAxisCursor,
} from "./chart-parts";
import { planLine } from "./chart-plan";
import type { TimeZoneMode } from "./chart-scale";
import { CartesianAxes } from "./chart-axes";
import { useChartBox } from "./use-chart-box";

export interface LineChartProps extends ChartBaseProps, ValueFormatOptions {
  /**
   * One x per point, shared by every series. Dates (or `xType="time"` with epoch
   * ms or ISO strings) make a time axis, numbers a number axis, anything else
   * categories. Omitted: the points are numbered.
   */
  x?: readonly ChartX[];
  /** Up to eight are drawn (one series colour and shape each); the table lists up to 24. */
  series: readonly ChartSeries[];
  /** Overrides the axis type inferred from `x`. */
  xType?: XScaleType;
  /** The calendar time ticks and labels are read in. @default "local" */
  timeZone?: TimeZoneMode;
  /** Formats a number-axis x value. */
  formatX?: (value: number) => string;
  /** Fill under each line with a wash of its colour. */
  area?: boolean;
  /** Pins the value axis's lower end. Unpinned, the axis starts at zero (or below it). */
  min?: number;
  /** Pins the value axis's upper end. */
  max?: number;
}

/**
 * A line (or area) chart over a category, number or time axis: value axis with
 * nice ticks and gridlines, x labels thinned to the width it has, a legend that
 * pairs each colour with a shape, and a table that is always there for a screen
 * reader and shown in place of the drawing on request or when nothing can be
 * drawn.
 *
 * Interactive: a crosshair snaps to the nearest x with one tooltip listing
 * every series there. The plot takes focus; arrows step, Home/End jump, and the
 * values are announced politely. A tap inspects a point on touch.
 *
 * Height is `h-chart` (density-aware); width is the container's.
 */
export function LineChart({
  label,
  summary,
  x,
  series,
  xType,
  timeZone,
  formatX,
  area = false,
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
}: LineChartProps) {
  const words = useLabels("Chart", DEFAULT_CHART_LABELS, labels);
  const locale = useLocale(localeProp);
  const formatters = useMemo(() => makeFormatters({ unit, format, formatTick, locale }), [unit, format, formatTick, locale]);
  const model = useMemo(
    () => modelCartesian({ x, series, xType, timeZone, locale, formatX }),
    [x, series, xType, timeZone, locale, formatX],
  );
  const plotRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const box = useChartBox(plotRef, probeRef);
  const plan = useMemo(
    () => planLine(model, box, { area, min, max, formatters }),
    [model, box, area, min, max, formatters],
  );

  const order = plan?.order ?? [];
  const rowX = plan?.rowX ?? [];
  const { active, source, handlers } = useAxisCursor({ order, rowPos: rowX, axis: "x", root: plotRef });
  const row = active === null ? undefined : model.rows[active];
  const drawn = drawnSeries(model.series);
  const readout = seriesReadout(row, drawn, formatters);
  const status = row ? readoutStatus(row.label, readout, source) : "";
  const cx = active === null ? null : (rowX[active] ?? null);

  return (
    <ChartFrame
      kind="line"
      label={label}
      {...cartesianFrameProps(model, formatters, words, summary, area ? "area" : "line")}
      legend={<ChartLegend line className={classNames?.legend} entries={drawn} />}
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
        className={cn("h-chart w-full", classNames?.plot)}
        {...handlers}
      >
        {plan && (
          <svg aria-hidden width={plan.width} height={plan.height} className="r-charts-svg absolute inset-0 block">
            <CartesianAxes
              plot={plan.plot}
              valueTicks={plan.yTicks}
              categoryLabels={plan.xLabels}
              zero={plan.zeroY}
              orientation="vertical"
              fontSize={box.fontSize}
            />
            {plan.series.map((s) => (
              <g key={s.series} data-series={s.series} className={cn("r-charts-series", SERIES_TEXT[s.slot])}>
                {s.area && <path d={s.area} className="r-charts-area" />}
                {s.path && <path d={s.path} className="r-charts-line" />}
                {s.markers.map((m) => (
                  <Mark key={m.row} shape={s.shape} x={m.x} y={m.y} r={plan.markerRadius} />
                ))}
              </g>
            ))}
            {cx !== null && active !== null && (
              <g data-chart-crosshair="" data-row={active}>
                <line x1={cx} x2={cx} y1={plan.plot.top} y2={plan.plot.bottom} className="r-charts-crosshair" />
                {plan.series.map((s) => {
                  const y = plan.rowY[s.series]?.[active] ?? null;
                  return y === null ? null : (
                    <g key={s.series} className={cn("r-charts-series", SERIES_TEXT[s.slot])}>
                      <Mark shape={s.shape} x={cx} y={y} r={plan.markerRadius * 1.25} />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        )}
        {plan && (
          <ChartReadout
            line
            open={row !== undefined}
            anchor={cx === null ? null : { x: cx, y: plan.plot.top, w: 0, h: plan.plot.bottom - plan.plot.top }}
            title={row?.label ?? ""}
            rows={readout}
            className={classNames?.tooltip}
          />
        )}
      </PlotRegion>
    </ChartFrame>
  );
}
