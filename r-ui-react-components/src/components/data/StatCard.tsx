"use client";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { type HTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { formatDelta, isPresent, MISSING } from "../../util/format";
import { cn, type SlotClassNames } from "../../util/style";
import { Skeleton } from "../primitives";
import { TONE_LABELS } from "../../util/tone";
import { StatusIcon } from "./data-tone";
import { type LabelsProp, mergeLabels } from "../../util/labels";

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
  /** The signed change. Its sign picks the arrow; `sentiment` picks the colour and the word. */
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
  /** The tile's words, per instance (translate them, or say "faster" for latency). */
  labels?: LabelsProp<StatCardLabels>;
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

export interface StatCardLabels {
  /** Shown after a `good` delta, so the judgement does not rest on colour. Default "better"; `""` drops it. */
  good: string;
  /** Shown after a `bad` delta. Default "worse"; `""` drops it. */
  bad: string;
  /** Shown after a `neutral` delta. Default `""` (nothing). */
  neutral: string;
  /** Spoken before the `stale` age, which the clock alone cannot say. Default "Stale". */
  stale: string;
}

export const DEFAULT_STAT_CARD_LABELS: StatCardLabels = {
  good: "better",
  bad: "worse",
  neutral: "",
  stale: TONE_LABELS.stale,
};

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
  labels: labelsProp,
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
  // A change that PRINTS as zero (0.04 at one decimal) is no change to the
  // reader: no arrow, no hue, no verdict, whatever its sign or sentiment.
  const flat = !hasDelta || format(delta) === format(0);
  const Arrow = flat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const shownSentiment: Sentiment = flat ? "neutral" : sentiment;
  const labels = mergeLabels(DEFAULT_STAT_CARD_LABELS, labelsProp);
  const sentimentWord = labels[shownSentiment];
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
            data-sentiment={hasDelta ? shownSentiment : undefined}
            className={cn(
              "flex flex-wrap items-center gap-x-r5 text-body-3 font-semibold tabular-nums",
              hasDelta ? SENTIMENT_TEXT[shownSentiment] : "text-fg-muted",
              classNames?.delta,
            )}
          >
            {hasDelta && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-r6">
                <Arrow aria-hidden className="size-icon shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{format(delta)}</span>
                {/* Visible, not only spoken: good or bad must not rest on the hue alone. */}
                {sentimentWord && <span className="font-normal">{sentimentWord}</span>}
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
              <span className="truncate">
                {labels.stale && <span className="sr-only">{labels.stale}: </span>}
                {stale}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
