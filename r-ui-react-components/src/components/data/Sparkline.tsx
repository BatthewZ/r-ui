import type { Ref, SVGAttributes } from "react";

import { formatNumber, isPresent } from "../../util/format";
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
  /** Formats the numbers in the default summary. */
  format?: (value: number) => string;
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
  format = (v) => formatNumber(v, { maximumFractionDigits: 1 }),
  series = 1,
  className,
  ref,
  ...rest
}: SparklineProps) {
  const present = values.filter(isPresent);
  const min = Math.min(...present);
  const max = Math.max(...present);
  const last = values.length > 0 ? values[values.length - 1] : undefined;
  const spoken =
    summary ??
    (present.length === 0
      ? "no data"
      : `low ${format(min)}, high ${format(max)}, latest ${isPresent(last) ? format(last) : "no data"}`);

  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const x = (i: number) => (values.length > 1 ? PAD + i * step : W / 2);
  const y = (v: number) => (max === min ? H / 2 : PAD + (H - PAD * 2) * (1 - (v - min) / (max - min)));

  // Runs of consecutive present values; a null breaks the line.
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (!isPresent(v)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
    pen = true;
  });

  const n = values.length;
  const prev = n > 1 ? values[n - 2] : undefined;
  const tail =
    isPresent(last) && isPresent(prev)
      ? `M${x(n - 2).toFixed(2)},${y(prev).toFixed(2)}L${x(n - 1).toFixed(2)},${y(last).toFixed(2)}`
      : "";

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`${label}: ${spoken}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("block h-[calc(var(--KPI-MIN)*1.25)] w-full overflow-visible", STROKE[series], className)}
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
          d={`M${x(n - 1).toFixed(2)},${y(last).toFixed(2)}h0`}
          strokeWidth={6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
