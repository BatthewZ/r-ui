"use client";
import { Star } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useState,
} from "react";

import { isRtl } from "../../util/direction";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import { clamp } from "./slider-core";

/** Every string the control says, for localisation. */
export interface RatingLabels {
  /** The value in words, spoken as the value text and as the read-only display's name: "4.5 out of 5". */
  value: (value: number, max: number) => string;
  /** No rating yet, or cleared. */
  none: string;
}

export const DEFAULT_RATING_LABELS: RatingLabels = {
  value: (value, max) => `${value} out of ${max}`,
  none: "No rating",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Rating: RatingLabels;
  }
}

export interface RatingProps extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "children"> {
  /** `null` is no rating. */
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
  /** How many icons. Default 5. */
  max?: number;
  /** Half steps: a press on an icon's inline-start half, and every key step, moves by a half. */
  allowHalf?: boolean;
  /** Pressing the current value, Delete, Backspace or 0 clears it (and arrows can step down to none). */
  clearable?: boolean;
  /**
   * A display, not a control: an image named by its value ("4.3 out of 5"),
   * out of the tab order, drawn at any fraction. A caller's `aria-label`
   * replaces that name entirely.
   */
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** The icon drawn for each step (default a star). It is drawn twice, outlined and filled, through `currentColor`. */
  icon?: ReactNode;
  /** Submitted as one hidden input (empty when there is no rating). Inside a bound Field: the Field's name. */
  name?: string;
  form?: string;
  labels?: LabelsProp<RatingLabels>;
  classNames?: SlotClassNames<"item" | "icon">;
}

/**
 * A rating out of `max` icons. Interactive, it is one WAI-ARIA `slider` (the
 * APG rating slider): a single tab stop whose value text says "3.5 out of 5",
 * arrows step (mirrored in RTL), Page Up/Down a whole icon, Home/End the ends,
 * digits jump. One slider rather than a radio group because half steps would
 * double the radios, and "no rating" is a value the slider can say, where a
 * radio group would need an uncheckable radio. A press on an icon picks it;
 * a mouse hovering previews. The icons fill with `currentColor`, the domain's
 * rating colour (`text-rating`) by default, not the accent: a rating is data.
 * A `text-*` colour class on the root retints them.
 */
export function Rating({
  value,
  defaultValue = null,
  onValueChange,
  max: maxProp = 5,
  allowHalf = false,
  clearable = false,
  readOnly: readOnlyProp,
  disabled: disabledProp,
  invalid: invalidProp,
  icon,
  name,
  form,
  labels: labelsProp,
  className,
  classNames,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  onKeyDown,
  onPointerLeave,
  ...props
}: RatingProps) {
  const labels = useLabels("Rating", DEFAULT_RATING_LABELS, labelsProp);
  const field = useFieldControl({
    id,
    invalid: invalidProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  });
  const [current, setCurrent, fieldName] = useFieldValue<number | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null),
  });
  const [preview, setPreview] = useState<number | null>(null);

  const max = Math.max(1, Math.round(maxProp));
  const step = allowHalf ? 0.5 : 1;
  const readOnly = field.readOnly === true;
  const disabled = field.disabled === true;
  const present = current !== null && Number.isFinite(current) && current > 0;
  // A display draws any fraction; a control holds what its steps can reach.
  const shown = !present ? null : readOnly ? clamp(current, 0, max) : clamp(Math.round(current / step) * step, step, max);
  const text = shown === null ? labels.none : labels.value(shown, max);
  const submitName = name ?? fieldName;

  /** What a step to `target` lands on: at or below none, `null` if clearable, else the lowest rating once there is one. */
  const settle = (target: number): number | null => {
    if (target > 0) return clamp(target, step, max);
    if (clearable || shown === null) return null;
    return step;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const now = shown ?? 0;
    const toEnd = isRtl(event.currentTarget) ? -1 : 1;
    let target: number;
    switch (event.key) {
      case "ArrowRight":
        target = now + step * toEnd;
        break;
      case "ArrowLeft":
        target = now - step * toEnd;
        break;
      case "ArrowUp":
        target = now + step;
        break;
      case "ArrowDown":
        target = now - step;
        break;
      case "PageUp":
        target = now + 1;
        break;
      case "PageDown":
        target = now - 1;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = max;
        break;
      case "Delete":
      case "Backspace":
        if (!clearable) return;
        target = 0;
        break;
      default: {
        const digit = /^\d$/.test(event.key) ? Number(event.key) : Number.NaN;
        if (!(digit <= max) || (digit === 0 && !clearable)) return;
        target = digit;
      }
    }
    event.preventDefault();
    setPreview(null);
    setCurrent(settle(target));
  };

  /** The value a pointer over icon `index` points at: its inline-start half is the half step. */
  const valueAt = (index: number, event: MouseEvent<HTMLSpanElement>) => {
    if (!allowHalf) return index + 1;
    const r = event.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return index + 1;
    const fromStart = (event.clientX - r.left) / r.width;
    return (isRtl(event.currentTarget) ? 1 - fromStart : fromStart) < 0.5 ? index + 0.5 : index + 1;
  };

  const interactive = !readOnly && !disabled;
  const drawn = (interactive ? preview : null) ?? shown ?? 0;
  const icons = Array.from({ length: max }, (_, index) => {
    const fill = clamp(drawn - index, 0, 1);
    return (
      <span
        key={index}
        className={cn("r-form-rating-item", classNames?.item)}
        data-fill={fill === 1 ? "full" : fill > 0 ? "part" : "empty"}
        onClick={
          interactive
            ? (event) => {
                const picked = valueAt(index, event);
                setPreview(null);
                setCurrent(clearable && picked === shown ? null : picked);
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (event: PointerEvent<HTMLSpanElement>) => {
                if (event.pointerType === "mouse") setPreview(valueAt(index, event));
              }
            : undefined
        }
      >
        <span aria-hidden className="r-form-rating-glyph">
          <span className={cn("r-form-rating-icon r-form-rating-base", classNames?.icon)}>{icon ?? <Star />}</span>
          <span
            className={cn("r-form-rating-icon r-form-rating-fill", classNames?.icon)}
            style={{ "--r-form-rating-fill": fill } as CSSProperties}
          >
            {icon ?? <Star />}
          </span>
        </span>
      </span>
    );
  });

  const hidden = submitName !== undefined && (
    <input type="hidden" name={submitName} form={form} value={shown === null ? "" : String(shown)} />
  );

  if (readOnly) {
    return (
      <>
        <div
          role="img"
          id={field.id}
          aria-label={ariaLabel ?? text}
          aria-labelledby={ariaLabelledBy}
          {...props}
          className={cn("r-form-rating text-rating", className)}
          data-readonly=""
          data-disabled={disabled ? "" : undefined}
          onKeyDown={onKeyDown}
          onPointerLeave={onPointerLeave}
        >
          {icons}
        </div>
        {hidden}
      </>
    );
  }

  return (
    <>
      <div
        role="slider"
        tabIndex={disabled ? undefined : 0}
        id={field.id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? (ariaLabel === undefined ? field.labelId : undefined)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={shown ?? 0}
        aria-valuetext={text}
        aria-orientation="horizontal"
        aria-disabled={disabled || undefined}
        {...field.ariaProps}
        {...props}
        className={cn("r-form-rating text-rating", className)}
        data-disabled={disabled ? "" : undefined}
        data-invalid={field.invalid ? "" : undefined}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onPointerLeave={composeEventHandlers(onPointerLeave, () => setPreview(null))}
      >
        {icons}
      </div>
      {hidden}
    </>
  );
}
