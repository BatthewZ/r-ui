"use client";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

import { isRtl } from "../../util/direction";
import { formatNumber, type FormatNumberOptions } from "../../util/format";
import { useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";

import {
  fractionOf,
  keyTarget,
  moveThumb,
  pickThumb,
  sameValues,
  type SliderOrientation,
  thumbBounds,
  type ThumbScale,
} from "./slider-core";
import { pointerFraction, usePointerDrag } from "./slider-pointer";

/** A mark on the track: a value, or a value with a visible label under (beside) it. */
export type SliderMark = number | { value: number; label?: ReactNode };

/** The parts a caller may style: `className` is the root. */
export type SliderSlot = "control" | "track" | "fill" | "thumb" | "marks" | "bubble";

/** How a slider writes its value: a formatter wins; otherwise the locale and the options. */
export interface SliderFormatProps {
  /** BCP 47 locale for the value text, the bubble and numeric mark labels. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** Number formatting for the value, e.g. `{ style: "unit", unit: "percent" }` or a currency. */
  formatOptions?: Omit<FormatNumberOptions, "locale" | "missing">;
  /** The value as words, for `aria-valuetext` and the bubble (e.g. `(v) => \`${v} requests a second\``). Wins over `formatOptions`. */
  formatValue?: (value: number) => string;
}

export function useSliderFormat({ locale: localeProp, formatOptions, formatValue }: SliderFormatProps) {
  const locale = useLocale(localeProp);
  return formatValue ?? ((value: number) => formatNumber(value, { locale, ...formatOptions }));
}

/** A large step when the caller gives none: a tenth of the scale, on the grid, at least one step. */
export const defaultLargeStep = (min: number, max: number, step: number) =>
  Math.max(step, Math.round((max - min) / 10 / step) * step);

/** What one thumb is called and described by. */
export interface SliderThumbAria {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}

export interface SliderFrameProps extends Omit<ComponentPropsWithRef<"div">, "onChange" | "defaultValue" | "children"> {
  /** In order, already on the scale. */
  values: readonly number[];
  onValuesChange: (next: readonly number[]) => void;
  onValuesCommit?: (next: readonly number[]) => void;
  scale: ThumbScale;
  largeStep: number;
  orientation: SliderOrientation;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  marks: readonly SliderMark[] | undefined;
  formatValue: (value: number) => string;
  showValue: boolean;
  thumb: (index: number) => SliderThumbAria;
  classNames?: SlotClassNames<SliderSlot>;
  /** After the control: the hidden inputs. */
  children?: ReactNode;
}

const percent = (fraction: number) => `${fraction * 100}%`;
const edgeOf = (fraction: number) => (fraction === 0 ? "start" : fraction === 1 ? "end" : undefined);

/**
 * The slider family's one implementation (WAI-ARIA APG slider and multi-thumb
 * slider): N thumbs, each a `role="slider"` with its own keys, on a track
 * whose whole strip (at least `--HIT-MIN` thick) takes presses. A press grabs
 * the nearest thumb and drags it; thumbs stop at each other. `onValuesCommit`
 * runs once per gesture that changed something: on release, on key up, or
 * when focus leaves mid-key.
 */
export function SliderFrame({
  values,
  onValuesChange,
  onValuesCommit,
  scale,
  largeStep,
  orientation,
  disabled,
  readOnly,
  invalid,
  marks,
  formatValue,
  showValue,
  thumb,
  className,
  classNames,
  children,
  ...props
}: SliderFrameProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  // The working values: the rendered ones, plus any change asked for since.
  const current = useRef(values);
  current.current = values;
  // What the gesture started from; `null` between gestures.
  const started = useRef<readonly number[] | null>(null);
  // The thumb a press grabbed; on stacked thumbs, the pair and where the press was, until the drag picks.
  const grabbed = useRef<number | { pair: readonly [number, number]; from: number }>(0);
  const pressing = useRef(false);

  const change = (next: readonly number[]) => {
    if (next === current.current) return;
    current.current = next;
    onValuesChange(next);
  };
  const begin = () => {
    started.current ??= current.current;
  };
  const commit = () => {
    const from = started.current;
    started.current = null;
    if (from && !sameValues(from, current.current)) onValuesCommit?.(current.current);
  };

  const valueAt = (event: { clientX: number; clientY: number }) => {
    const rail = railRef.current;
    if (!rail) return scale.min;
    const f = pointerFraction(rail, event);
    return scale.min + (orientation === "horizontal" ? f.x : 1 - f.y) * (scale.max - scale.min);
  };

  /** Half a thumb, in value units: a press that close to stacked thumbs is on them. */
  const slop = () => {
    const rail = railRef.current?.getBoundingClientRect().width ?? 0;
    const thumbWidth = thumbRefs.current[0]?.getBoundingClientRect().width ?? 0;
    return rail > 0 ? (thumbWidth / 2 / rail) * (scale.max - scale.min) : 0;
  };

  const drag = usePointerDrag<HTMLDivElement>({
    grab(event) {
      const target = valueAt(event);
      const pick = pickThumb(current.current, target, slop());
      grabbed.current = typeof pick === "number" ? pick : { pair: pick, from: target };
      pressing.current = true;
      begin();
      if (!readOnly && typeof pick === "number") setDragging(pick);
      return thumbRefs.current[typeof pick === "number" ? pick : pick[0]];
    },
    move(event) {
      if (readOnly) return;
      const target = valueAt(event);
      let index = grabbed.current;
      if (typeof index !== "number") {
        // Stacked thumbs: the first direction the drag takes decides.
        if (target === index.from) return;
        index = target > index.from ? index.pair[1] : index.pair[0];
        grabbed.current = index;
        setDragging(index);
        thumbRefs.current[index]?.focus({ preventScroll: true });
      }
      change(moveThumb(current.current, index, target, scale));
    },
    release() {
      pressing.current = false;
      setDragging(null);
      commit();
    },
  });

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || readOnly) return;
    const now = current.current[index];
    if (now === undefined) return;
    const target = keyTarget(event.key, event.shiftKey, now, {
      ...scale,
      largeStep,
      rtl: isRtl(event.currentTarget),
      orientation,
    });
    if (target === null) return;
    event.preventDefault();
    begin();
    change(moveThumb(current.current, index, target, scale));
  };
  const onKeyUp = () => {
    if (!pressing.current) commit();
  };
  // Focus leaving mid-key ends the gesture. A tied press hands focus between
  // thumbs mid-drag: that is not the end of it.
  const onBlur = () => {
    if (!pressing.current) commit();
  };

  const fractions = values.map((v) => fractionOf(v, scale.min, scale.max));
  const from = values.length > 1 ? (fractions[0] ?? 0) : 0;
  const to = fractions[fractions.length - 1] ?? 0;
  const shownMarks = (marks ?? [])
    .map((mark) => (typeof mark === "number" ? { value: mark, label: undefined } : mark))
    .filter((mark) => Number.isFinite(mark.value) && mark.value >= scale.min && mark.value <= scale.max)
    .map((mark) => ({ ...mark, at: fractionOf(mark.value, scale.min, scale.max) }));
  const labelled = shownMarks.filter((mark) => mark.label !== undefined && mark.label !== null && mark.label !== false);

  return (
    <div
      {...props}
      className={cn("r-form-slider", className)}
      data-orientation={orientation}
      data-disabled={disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
    >
      <div className={cn("r-form-slider-control", classNames?.control)} {...(disabled ? {} : drag)}>
        <div ref={railRef} className="r-form-slider-rail">
          <div aria-hidden className={cn("r-form-slider-track", classNames?.track)}>
            <div
              className={cn("r-form-slider-fill", classNames?.fill)}
              data-print="exact"
              style={{ "--r-form-slider-from": percent(from), "--r-form-slider-to": percent(to) } as CSSProperties}
            />
          </div>
          {shownMarks.map((mark) => (
            <span
              key={mark.value}
              aria-hidden
              className="r-form-slider-tick"
              data-active={mark.at >= from && mark.at <= to ? "" : undefined}
              style={{ "--r-form-slider-at": percent(mark.at) } as CSSProperties}
            />
          ))}
          {values.map((value, index) => {
            const [lo, hi] = thumbBounds(values, index, scale);
            return (
              <div
                // Thumbs are positions, not items: a thumb keeps its node (and focus) as it moves.
                key={index}
                ref={(el) => {
                  thumbRefs.current[index] = el;
                }}
                role="slider"
                tabIndex={disabled ? undefined : 0}
                aria-valuemin={lo}
                aria-valuemax={hi}
                aria-valuenow={value}
                aria-valuetext={formatValue(value)}
                aria-orientation={orientation}
                aria-disabled={disabled || undefined}
                aria-readonly={readOnly || undefined}
                {...thumb(index)}
                data-dragging={dragging === index ? "" : undefined}
                className={cn("r-form-slider-thumb", classNames?.thumb)}
                style={{ "--r-form-slider-at": percent(fractions[index] ?? 0) } as CSSProperties}
                onKeyDown={(event) => onKeyDown(index, event)}
                onKeyUp={onKeyUp}
                onBlur={onBlur}
              >
                <span aria-hidden className="r-form-slider-thumb-hit hit-area" />
                {showValue && (
                  <span aria-hidden className="r-form-slider-bubble-anchor" data-print="hide">
                    <span className={cn("r-form-slider-bubble bg-fg-primary text-body-3 text-fg-inverse", classNames?.bubble)}>
                      {formatValue(value)}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {labelled.length > 0 && (
        <div aria-hidden className={cn("r-form-slider-marks text-body-3 text-fg-muted", classNames?.marks)}>
          {labelled.map((mark) => (
            <span
              key={mark.value}
              className="r-form-slider-mark"
              data-edge={edgeOf(mark.at)}
              style={{ "--r-form-slider-at": percent(mark.at) } as CSSProperties}
            >
              <span className="r-form-slider-mark-label">{mark.label}</span>
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
