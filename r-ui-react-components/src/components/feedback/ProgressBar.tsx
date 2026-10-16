"use client";
import { type HTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { MARK_TEXT, TONE_SOLID, ToneGlyph } from "../../util/tone";
import {
  DEFAULT_PROGRESS_LABELS,
  percentText,
  type ProgressLabels,
  type ProgressTone,
  readProgress,
  spokenText,
} from "./progress-model";

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Work done, from 0 to `max`. `null` / `undefined` (or `NaN`): indeterminate. */
  value?: number | null;
  /** The total. `segmented`: the number of steps (a whole number). Default 100. */
  max?: number;
  /** What is progressing. Names the bar; shown above the track unless `hideLabel`. */
  label: ReactNode;
  /** Keeps `label` as the bar's name but hides it (a table cell, a row that already says it). */
  hideLabel?: boolean;
  /** Shows the value (a percentage, "2 of 5", or the indeterminate word). Default true. */
  showValue?: boolean;
  /** The value as text, shown and spoken ("3.2 of 10 MB"). Default: a percentage, or steps when segmented. */
  valueText?: string;
  /**
   * `accent` (default) is ordinary progress. A status tone (`success`, `warning`,
   * `error`, `info`, `serious`) colours the fill, draws its glyph by the value
   * and is spoken after it, so it never rests on colour.
   */
  tone?: ProgressTone;
  /**
   * `continuous` (default): one track. `segmented`: a multi-step job, one
   * segment per step (`max` steps); `value` counts steps done, a fraction fills
   * part of the current one.
   */
  variant?: "continuous" | "segmented";
  /** Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  labels?: LabelsProp<ProgressLabels>;
  classNames?: SlotClassNames<"label" | "value" | "track" | "fill">;
  ref?: Ref<HTMLDivElement>;
}

/** Most segments drawn; a job with more steps than this is a percentage, not a row of slivers. */
const MAX_SEGMENTS = 50;

const TRACK = "r-feedback-progress-track relative h-r5 overflow-hidden rounded-full bg-fg-primary/10";

/**
 * Progress of work toward done: an upload, an import, a multi-step job.
 * `role="progressbar"`. Not a `Meter`, which shows a measured value inside a
 * range (CPU, quota) that can go up or down and is never "done".
 *
 * Determinate: `aria-valuenow` / `aria-valuemax` and an `aria-valuetext` that
 * matches the visible value (a locale percentage, rounded down so unfinished
 * work never reads 100%). Indeterminate (no `value`): a short bar sweeps along
 * the track; under reduced motion it stands still as a striped track, and the
 * value slot says the indeterminate word. The fill eases between values with
 * the motion tokens (instant under reduced motion). Thickness follows density
 * (`--R-SIZE-5`). Under forced colours the track keeps an outline and the fill
 * its system colour; on paper the fill prints (`data-print="exact"`).
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  hideLabel = false,
  showValue = true,
  valueText,
  tone = "accent",
  variant = "continuous",
  locale: localeProp,
  labels: labelsProp,
  className,
  classNames,
  ref,
  ...rest
}: ProgressBarProps) {
  const labelId = useId();
  const labels = useLabels("Progress", DEFAULT_PROGRESS_LABELS, labelsProp);
  const locale = useLocale(localeProp);
  const segmented = variant === "segmented";
  const segments = segmented ? Math.min(MAX_SEGMENTS, Math.max(1, Math.round(max))) : 0;
  const reading = readProgress(value, segmented ? segments : max);

  const text =
    valueText ??
    (!reading.determinate
      ? labels.indeterminate
      : segmented
        ? labels.steps(Math.floor(reading.value + 1e-9), segments)
        : percentText(reading.share, locale));
  const isStatus = tone !== "accent" && tone !== "neutral";

  const fill = (share: number, key?: number) => (
    <div
      key={key}
      data-print="exact"
      className={cn(
        "h-full rounded-full transition-[inline-size] duration-normal ease-standard",
        TONE_SOLID[tone],
        classNames?.fill,
      )}
      style={{ inlineSize: `${share * 100}%` }}
    />
  );

  const track = segmented ? (
    <div className={cn("flex min-w-0 flex-1 gap-r6", classNames?.track)}>
      {Array.from({ length: segments }, (_, i) => {
        const share = reading.determinate ? Math.min(1, Math.max(0, reading.value - i)) : 0;
        return (
          <div
            key={i}
            data-segment={share >= 1 ? "done" : share > 0 ? "partial" : "pending"}
            className={cn(TRACK, "flex-1")}
          >
            {fill(share)}
          </div>
        );
      })}
    </div>
  ) : (
    <div className={cn(TRACK, "min-w-0 flex-1", classNames?.track)}>
      {reading.determinate ? (
        fill(reading.share)
      ) : (
        <div
          data-print="exact"
          className={cn("r-feedback-progress-sweep rounded-full", TONE_SOLID[tone], classNames?.fill)}
        />
      )}
    </div>
  );

  const valueNode = showValue && (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center gap-r6 text-body-2 tabular-nums text-fg-primary",
        classNames?.value,
      )}
    >
      {isStatus && <ToneGlyph tone={tone} className={cn("size-icon shrink-0", MARK_TEXT[tone])} />}
      {text}
    </span>
  );

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-labelledby={labelId}
      aria-valuemin={reading.determinate ? 0 : undefined}
      aria-valuemax={reading.determinate ? reading.max : undefined}
      aria-valuenow={reading.determinate ? reading.value : undefined}
      aria-valuetext={spokenText(text, labels.tones[tone])}
      data-tone={tone}
      data-indeterminate={reading.determinate ? undefined : ""}
      className={cn(
        "flex min-w-0",
        hideLabel ? "items-center gap-r4" : "flex-col gap-r5",
        className,
      )}
      {...rest}
    >
      {hideLabel ? (
        <>
          <span id={labelId} className="sr-only">
            {label}
          </span>
          {track}
          {valueNode}
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-baseline justify-between gap-r4 text-body-2">
            <span id={labelId} className={cn("min-w-0 break-words text-fg-secondary", classNames?.label)}>
              {label}
            </span>
            {valueNode}
          </div>
          <div className="flex min-w-0">{track}</div>
        </>
      )}
    </div>
  );
}
