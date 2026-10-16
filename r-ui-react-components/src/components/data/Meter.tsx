"use client";
import { type HTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { formatNumber, isPresent, MISSING } from "../../util/format";
import { cn, type SlotClassNames } from "../../util/style";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { type Tone, TONE_LABELS } from "../../util/tone";
import { STATUS_FILL, StatusIcon } from "./data-tone";

export type MeterTone = Extract<Tone, "neutral" | "success" | "info" | "warning" | "serious" | "error">;

export interface MeterThreshold {
  /** The boundary value, in the meter's own units. */
  at: number;
  tone: MeterTone;
}

export interface MeterLabels {
  /** The word spoken after the value, per threshold tone ("85%, Warning"). `""` silences it. */
  tones: Record<Tone, string>;
}

export const DEFAULT_METER_LABELS: MeterLabels = { tones: TONE_LABELS };

declare module "../../util/locale" {
  interface LabelsRegistry {
    Meter: MeterLabels;
  }
}

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  value: number | null | undefined;
  min?: number;
  max?: number;
  /** What is measured. Visible in `stacked`; the meter's name in both variants. */
  label: ReactNode;
  /**
   * Boundaries that turn the fill into a status. With `worse="high"` (CPU,
   * latency) a threshold applies from `at` upward; with `worse="low"` (budget
   * remaining, disk free) from `at` downward. The most severe match wins.
   */
  thresholds?: readonly MeterThreshold[];
  worse?: "high" | "low";
  /** The value as text. Default: a percentage of the range. */
  valueText?: string;
  labels?: LabelsProp<MeterLabels>;
  /**
   * `stacked`: label and value above a full-width track (a list, a card).
   * `inline`: a short track beside the value, label kept for screen readers
   * (a table cell).
   */
  variant?: "stacked" | "inline";
  classNames?: SlotClassNames<"label" | "value" | "track" | "fill">;
  ref?: Ref<HTMLDivElement>;
}

const SEVERITY: Record<MeterTone, number> = { neutral: 0, success: 1, info: 1, warning: 2, serious: 3, error: 4 };

/** The tone `value` falls into. Exported for tables that colour a cell by the same rule. */
export function meterTone(value: number, thresholds: readonly MeterThreshold[], worse: "high" | "low"): MeterTone {
  let tone: MeterTone = "neutral";
  for (const t of thresholds) {
    const hit = worse === "high" ? value >= t.at : value <= t.at;
    if (hit && SEVERITY[t.tone] >= SEVERITY[tone]) tone = t.tone;
  }
  return tone;
}

/**
 * A value within a known range (CPU, error budget, quota), with
 * thresholds that map to status tones. A tone shows as the fill colour AND a
 * distinct icon beside the value, and is spoken in `aria-valuetext`, so it is
 * never colour alone. `role="meter"`: it moves both ways and is never done.
 * Work toward done (an upload, a migration) is a `ProgressBar` instead.
 */
export function Meter({
  value,
  min = 0,
  max = 100,
  label,
  thresholds = [],
  worse = "high",
  valueText,
  labels: labelsProp,
  variant = "stacked",
  className,
  classNames,
  ref,
  ...rest
}: MeterProps) {
  const labelId = useId();
  const present = isPresent(value);
  const span = max - min || 1;
  const share = present ? (value - min) / span : 0;
  // Only the fill clamps: the text says the real share, so 140 of 100 reads "140%", not "100%".
  const ratio = Math.min(1, Math.max(0, share));
  const tone = present ? meterTone(value, thresholds, worse) : "neutral";
  const locale = useLocale();
  const text = valueText ?? (present ? formatNumber(share, { locale, style: "percent", maximumFractionDigits: 0 }) : MISSING);
  const word = useLabels("Meter", DEFAULT_METER_LABELS, labelsProp).tones[tone];
  const spoken = word ? `${text}, ${word}` : text;
  const showIcon = tone !== "neutral";

  const track = (
    <div
      role="meter"
      aria-labelledby={labelId}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={present ? value : undefined}
      aria-valuetext={spoken}
      data-tone={tone}
      className={cn(
        "r-data-meter-track h-r5 overflow-hidden rounded-full bg-fg-primary/10",
        variant === "inline" ? "w-[calc(var(--CONTROL-H)*1.5)] shrink-0" : "w-full",
        classNames?.track,
      )}
    >
      <div
        className={cn("h-full rounded-full", STATUS_FILL[tone], classNames?.fill)}
        style={{ inlineSize: `${ratio * 100}%` }}
      />
    </div>
  );

  const valueNode = (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center gap-r6 tabular-nums text-fg-primary", classNames?.value)}
    >
      {showIcon && <StatusIcon tone={tone} />}
      {text}
    </span>
  );

  if (variant === "inline") {
    return (
      <div ref={ref} className={cn("inline-flex max-w-full items-center gap-r4 align-middle", className)} {...rest}>
        <span id={labelId} className="sr-only">
          {label}
        </span>
        {track}
        {valueNode}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("flex min-w-0 flex-col gap-r5", className)} {...rest}>
      <div className="flex items-baseline justify-between gap-r4 text-body-2">
        <span id={labelId} className={cn("min-w-0 truncate text-fg-secondary", classNames?.label)}>
          {label}
        </span>
        {valueNode}
      </div>
      {track}
    </div>
  );
}
