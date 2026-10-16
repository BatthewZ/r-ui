"use client";
import type { Ref, SVGAttributes } from "react";

import { formatNumber, isPresent } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn } from "../../util/style";

export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/* Literal strings so Tailwind's scanner sees every utility. */
const STROKE: Record<SeriesSlot | "total", string> = {
  total: "stroke-fg-primary",
  1: "stroke-series-1",
  2: "stroke-series-2",
  3: "stroke-series-3",
  4: "stroke-series-4",
  5: "stroke-series-5",
  6: "stroke-series-6",
  7: "stroke-series-7",
  8: "stroke-series-8",
};

/** The words of the default spoken summary. */
export interface SparklineLabels {
  /** For a series with no value at all, and for a missing latest value. */
  noData: string;
  /** The default summary, from the formatted low, high and latest values. */
  summary: (low: string, high: string, latest: string) => string;
}

export const DEFAULT_SPARKLINE_LABELS: SparklineLabels = {
  noData: "no data",
  summary: (low, high, latest) => `low ${low}, high ${high}, latest ${latest}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Sparkline: SparklineLabels;
  }
}

export interface SparklineProps extends Omit<SVGAttributes<SVGSVGElement>, "values" | "children" | "format"> {
  /** The series, oldest first. `null` is a gap (no data), never a zero. */
  values: readonly (number | null | undefined)[];
  /** What the line is, for its accessible name ("Requests per second, last 24h"). */
  label: string;
  /**
   * The spoken summary after the name. Default: low, high and latest, through
   * `format`. Pass your own when the trend matters more than the range.
   */
  summary?: string;
  /** Formats the numbers in the default summary. Default: `formatNumber`, one fraction digit, in the `LocaleProvider`'s locale. */
  format?: (value: number) => string;
  labels?: LabelsProp<SparklineLabels>;
  /**
   * The entity's series slot (fixed per entity, never cycled). `"total"` is a
   * line that sums several series: it takes the primary ink, so it never reads
   * as one of the entities drawn beside it.
   */
  series?: SeriesSlot | "total";
  ref?: Ref<SVGSVGElement>;
}

const W = 100;
const H = 32;
const PAD = 3;

/**
 * A word-sized trend line. Data mark only: no axes, no grid. The last
 * segment and point are emphasised, because "where is it now" is the
 * question a sparkline answers.
 *
 * The SVG stretches to its box (`preserveAspectRatio="none"`) and its strokes
 * opt out of the stretch, so it is crisp at any width. Its box defaults to
 * the full width and a KPI-relative height; size it with `className`.
 * `role="img"` with the label and a spoken summary as its name.
 */
export function Sparkline({
  values,
  label,
  summary,
  format: formatProp,
  series = 1,
  labels: labelsProp,
  className,
  ref,
  ...rest
}: SparklineProps) {
  const labels = useLabels("Sparkline", DEFAULT_SPARKLINE_LABELS, labelsProp);
  const locale = useLocale();
  const format = formatProp ?? ((v: number) => formatNumber(v, { locale, maximumFractionDigits: 1 }));
  const present = values.filter(isPresent);
  const min = Math.min(...present);
  const max = Math.max(...present);
  const last = values.length > 0 ? values[values.length - 1] : undefined;
  const spoken =
    summary ??
    (present.length === 0
      ? labels.noData
      : labels.summary(format(min), format(max), isPresent(last) ? format(last) : labels.noData));

  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const x = (i: number) => (values.length > 1 ? PAD + i * step : W / 2);
  // Halved before dividing: `1e308 - -1e308` is Infinity, and Infinity / Infinity a NaN path.
  const y = (v: number) => (max === min ? H / 2 : PAD + (H - PAD * 2) * (1 - (v / 2 - min / 2) / (max / 2 - min / 2)));
  const point = (i: number, v: number) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`;

  // Runs of consecutive present values; a null breaks the line.
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (!isPresent(v)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${point(i, v)}`;
    pen = true;
  });

  const n = values.length;
  const prev = n > 1 ? values[n - 2] : undefined;
  const tail =
    isPresent(last) && isPresent(prev)
      ? `M${point(n - 2, prev)}L${point(n - 1, last)}`
      : "";

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`${label}: ${spoken}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("block h-spark w-full overflow-visible", STROKE[series], className)}
      fill="none"
      {...rest}
    >
      {d && (
        <path
          d={d}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {tail && <path d={tail} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      {isPresent(last) && (
        // A zero-length segment with a round cap and a non-scaling stroke draws
        // a true circle even though the SVG is stretched.
        <path
          data-sparkline-point=""
          d={`M${point(n - 1, last)}h0`}
          strokeWidth={6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
