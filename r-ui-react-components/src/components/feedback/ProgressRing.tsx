"use client";
import type { HTMLAttributes, ReactNode, Ref } from "react";

import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { MARK_TEXT } from "../../util/tone";
import {
  DEFAULT_PROGRESS_LABELS,
  percentText,
  type ProgressLabels,
  type ProgressTone,
  readProgress,
  spokenText,
} from "./progress-model";

/**
 * The ring's box, from the density tokens: `icon` sits in a line of text or a
 * button, `control` beside controls (it is `--CONTROL-H`, so it follows the hit
 * floor like its neighbours), `large` stands alone with a label in its centre.
 */
export type ProgressRingSize = "icon" | "control" | "large";

export interface ProgressRingProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Work done, from 0 to `max`. `null` / `undefined` (or `NaN`): indeterminate. */
  value?: number | null;
  max?: number;
  /** The ring's accessible name: what is progressing. A caller's `aria-labelledby` wins. */
  label: string;
  size?: ProgressRingSize;
  /** Shows the percentage in the centre (`control` and `large`). */
  showValue?: boolean;
  /** The value as text, spoken and (with `showValue`) shown. Default: a percentage. */
  valueText?: string;
  /** `accent` (default) or a status tone, spoken after the value. */
  tone?: ProgressTone;
  /** The centre (`control` and `large`), over the value; decorative to assistive tech, which hears `aria-valuetext`. */
  children?: ReactNode;
  /** Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  labels?: LabelsProp<ProgressLabels>;
  classNames?: SlotClassNames<"track" | "indicator" | "center">;
  ref?: Ref<HTMLDivElement>;
}

const BOX: Record<ProgressRingSize, string> = {
  icon: "size-icon",
  control: "size-control",
  large: "size-[calc(var(--ICON)*5)]",
};

/** Stroke in viewBox units (of 24): thicker at small sizes, so the ring never thins to a hairline. */
const STROKE: Record<ProgressRingSize, number> = { icon: 3.5, control: 3, large: 2 };

const CENTRE_TEXT: Record<Exclude<ProgressRingSize, "icon">, string> = {
  control: "text-body-3",
  large: "text-h4 font-semibold",
};

/**
 * Progress as a ring, for where a bar does not fit: a tile, an avatar badge,
 * an onboarding checklist. `role="progressbar"`, named by `label`, with the
 * same value reading as `ProgressBar` (clamped, a locale percentage rounded
 * down). Determinate: the arc grows clockwise from the top with the motion
 * tokens. Indeterminate: a quarter arc turns, and keeps turning under reduced
 * motion as `Spinner` does (an in-place rotation that says "still working";
 * a frozen arc reads as stuck). Under forced colours the track is GrayText and
 * the arc its system colour.
 */
export function ProgressRing({
  value,
  max = 100,
  label,
  size = "control",
  showValue = false,
  valueText,
  tone = "accent",
  children,
  locale: localeProp,
  labels: labelsProp,
  className,
  classNames,
  ref,
  ...rest
}: ProgressRingProps) {
  const labels = useLabels("Progress", DEFAULT_PROGRESS_LABELS, labelsProp);
  const locale = useLocale(localeProp);
  const reading = readProgress(value, max);
  const text = valueText ?? (reading.determinate ? percentText(reading.share, locale) : labels.indeterminate);
  const stroke = STROKE[size];
  const r = 12 - stroke / 2;
  const centre = children ?? (showValue && reading.determinate ? text : null);

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={reading.determinate ? 0 : undefined}
      aria-valuemax={reading.determinate ? reading.max : undefined}
      aria-valuenow={reading.determinate ? reading.value : undefined}
      aria-valuetext={spokenText(text, labels.tones[tone])}
      data-tone={tone}
      data-indeterminate={reading.determinate ? undefined : ""}
      className={cn("relative inline-grid shrink-0 place-items-center", BOX[size], className)}
      {...rest}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={cn("r-feedback-ring-svg col-start-1 row-start-1 size-full", !reading.determinate && "animate-spin")}
      >
        <circle cx="12" cy="12" r={r} strokeWidth={stroke} className={cn("r-feedback-ring-track", classNames?.track)} />
        <circle
          data-print="exact"
          cx="12"
          cy="12"
          r={r}
          strokeWidth={stroke}
          stroke="currentColor"
          // A round cap draws a dot at 0%, which reads as work begun.
          strokeLinecap={reading.determinate && reading.share === 0 ? "butt" : "round"}
          pathLength={100}
          strokeDasharray={reading.determinate ? "100" : "25 75"}
          strokeDashoffset={reading.determinate ? 100 - reading.share * 100 : 0}
          transform="rotate(-90 12 12)"
          className={cn(
            "transition-[stroke-dashoffset] duration-normal ease-standard",
            MARK_TEXT[tone],
            classNames?.indicator,
          )}
        />
      </svg>
      {centre != null && centre !== false && size !== "icon" && (
        <span
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 max-w-[80%] text-center tabular-nums text-fg-primary [overflow-wrap:anywhere]",
            CENTRE_TEXT[size],
            classNames?.center,
          )}
        >
          {centre}
        </span>
      )}
    </div>
  );
}
