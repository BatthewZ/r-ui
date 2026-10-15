"use client";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { type HTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { formatDelta, isPresent, MISSING } from "../../util/format";
import { cn, type SlotClassNames } from "../../util/style";
import { Skeleton } from "../primitives";
import { StatusIcon } from "./data-tone";

/** Whether the change is good news. Decided by the caller, never by the sign. */
export type Sentiment = "good" | "bad" | "neutral";

const SENTIMENT_TEXT: Record<Sentiment, string> = {
  good: "text-trend-good",
  bad: "text-trend-bad",
  neutral: "text-trend-flat",
};

export interface StatCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  label: ReactNode;
  /** The figure, already formatted (`formatNumber`, `formatCompact`…). Missing renders "—". */
  value: ReactNode;
  /** A unit set beside the value, smaller and quieter ("ms", "%"). */
  unit?: ReactNode;
  /** The signed change. Its sign picks the arrow; `sentiment` picks the colour. */
  delta?: number | null;
  /** Formats `delta`. Default: `formatDelta` (signed, zero unsigned). */
  formatDelta?: (delta: number) => string;
  /**
   * Is this change good news? "Error rate down" is `good`; "latency up" is
   * `bad`. Never inferred from direction. `neutral` draws it flat.
   */
  sentiment?: Sentiment;
  /** Context for the delta: "vs prior 7d". */
  deltaLabel?: ReactNode;
  /** The spoken judgement after the delta. `""` silences it. */
  sentimentLabels?: Partial<Record<Sentiment, string>>;
  /** A `Sparkline` (or any small chart). Sits beside the value in a wide tile, under it in a narrow one. */
  sparkline?: ReactNode;
  /** A status for the metric (a `StatusLabel`), under the delta. */
  status?: ReactNode;
  /**
   * How old the value is, when it is old ("12 min old"). Marks the tile stale:
   * a clock and this text, and the value steps back to secondary ink.
   */
  stale?: ReactNode;
  /** Skeleton value and delta while the first value loads. */
  loading?: boolean;
  classNames?: SlotClassNames<"label" | "value" | "unit" | "delta" | "chart" | "footer">;
  ref?: Ref<HTMLDivElement>;
}

const DEFAULT_SENTIMENT_LABELS: Record<Sentiment, string> = { good: "better", bad: "worse", neutral: "" };

/**
 * A KPI tile: label, value, change, and optionally a sparkline, a status and
 * a stale marker. The tile is a size container: the value is `text-kpi`
 * (`--KPI-VALUE`, sized by the TILE's width between the density's min and
 * max), and a roomy tile moves the sparkline beside the value.
 *
 * `role="group"` named by its label, so a screen reader hears "Error rate,
 * group" before the figure.
 */
export function StatCard({
  label,
  value,
  unit,
  delta,
  formatDelta: format = (d) => formatDelta(d, { maximumFractionDigits: 1 }),
  sentiment = "neutral",
  deltaLabel,
  sentimentLabels,
  sparkline,
  status,
  stale,
  loading = false,
  className,
  classNames,
  ref,
  ...rest
}: StatCardProps) {
  const labelId = useId();
  const hasDelta = isPresent(delta);
  const Arrow = !hasDelta || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const spokenSentiment = { ...DEFAULT_SENTIMENT_LABELS, ...sentimentLabels }[sentiment];
  const missingValue = value === null || value === undefined || value === "";

  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      data-stale={stale ? "" : undefined}
      className={cn(
        "@container flex min-w-0 flex-col gap-r5 rounded-lg border border-border bg-surface-0 px-r2 py-r3",
        className,
      )}
      {...rest}
    >
      <p id={labelId} className={cn("truncate text-body-2 font-medium text-fg-secondary", classNames?.label)}>
        {label}
      </p>

      <div className="flex flex-col gap-r5 @3xs:flex-row @3xs:items-end @3xs:justify-between @3xs:gap-r3">
        {loading ? (
          <Skeleton shape="block" className="h-(--KPI-VALUE) w-1/2 rounded-sm" />
        ) : (
          <p
            // Wraps only where it cannot fit: a normal figure stays one line, a
            // huge one breaks inside the tile instead of spilling out of it.
            className={cn(
              "min-w-0 text-kpi font-semibold tabular-nums [overflow-wrap:anywhere]",
              stale ? "text-fg-secondary" : "text-fg-primary",
              classNames?.value,
            )}
          >
            {missingValue ? MISSING : value}
            {unit && !missingValue && (
              <span className={cn("ms-r6 text-body-1 font-medium text-fg-secondary", classNames?.unit)}>{unit}</span>
            )}
          </p>
        )}
        {sparkline && !loading && (
          <div className={cn("min-w-0 @3xs:w-1/2 @3xs:shrink-0", classNames?.chart)}>{sparkline}</div>
        )}
      </div>

      {loading ? (
        <Skeleton shape="block" className="h-r3 w-2/3 rounded-sm" />
      ) : (
        (hasDelta || deltaLabel) && (
          <p
            data-sentiment={hasDelta ? sentiment : undefined}
            className={cn(
              "flex flex-wrap items-center gap-x-r5 text-body-3 font-semibold tabular-nums",
              hasDelta ? SENTIMENT_TEXT[sentiment] : "text-fg-muted",
              classNames?.delta,
            )}
          >
            {hasDelta && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-r6">
                <Arrow aria-hidden className="size-icon shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{format(delta)}</span>
                {spokenSentiment && <span className="sr-only">, {spokenSentiment}</span>}
              </span>
            )}
            {deltaLabel && <span className="font-normal text-fg-muted">{deltaLabel}</span>}
          </p>
        )
      )}

      {(status || stale) && (
        <div className={cn("flex flex-wrap items-center gap-x-r3 gap-y-r6 text-body-3", classNames?.footer)}>
          {status}
          {stale && (
            <span className="inline-flex min-w-0 items-center gap-r6 text-fg-stale">
              <StatusIcon tone="stale" />
              <span className="truncate">{stale}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
