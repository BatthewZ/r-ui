"use client";
import { type ComponentPropsWithRef } from "react";

import { type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import { snapToStep, type SliderOrientation } from "./slider-core";
import {
  defaultLargeStep,
  type SliderFormatProps,
  SliderFrame,
  type SliderMark,
  type SliderSlot,
  useSliderFormat,
} from "./slider-parts";

export interface SliderProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "children">,
    SliderFormatProps {
  value?: number;
  /** Default `min`. */
  defaultValue?: number;
  /** Every change, as it happens (each drag move, each key). */
  onValueChange?: (value: number) => void;
  /** Once per gesture that changed the value: on release, or on key up. Save here. */
  onValueCommit?: (value: number) => void;
  /** Default 0. */
  min?: number;
  /** Default 100. */
  max?: number;
  /** Default 1. A value sits on `min + k × step`. */
  step?: number;
  /** Page Up/Down and Shift + arrow. Default: a tenth of the scale, on the grid. */
  largeStep?: number;
  /** Ticks on the track; a mark with a `label` also shows it under (beside) the track. */
  marks?: readonly SliderMark[];
  /** Default `horizontal`. A vertical slider runs bottom (min) to top; size it with `className` (`h-…`). */
  orientation?: SliderOrientation;
  /** Shows the value in a bubble on the thumb while it is dragged or keyboard-focused. */
  showValue?: boolean;
  disabled?: boolean;
  /** Focusable and announced, but neither keys nor presses move it. */
  readOnly?: boolean;
  invalid?: boolean;
  /** Submitted as one hidden input. Inside a bound Field: the Field's name. */
  name?: string;
  /** The `<form>` the hidden input belongs to, by id. */
  form?: string;
  classNames?: SlotClassNames<SliderSlot>;
}

/**
 * Picks a number on a scale by dragging or by keys (WAI-ARIA APG slider):
 * arrows step (mirrored in RTL), Page Up/Down and Shift + arrow take a large
 * step, Home/End go to the ends. The thumb is the `role="slider"`; `id`,
 * `aria-label`, `aria-labelledby`, `aria-describedby` and `aria-invalid` land
 * on it, and inside a Field the label names it. The value is spoken through
 * `aria-valuetext`, formatted in the locale. `className` and the other props
 * style and address the root.
 */
export function Slider({
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  marks,
  orientation = "horizontal",
  showValue = false,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  invalid: invalidProp,
  name,
  form,
  locale,
  formatOptions,
  formatValue,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SliderProps) {
  const field = useFieldControl({
    id,
    invalid: invalidProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  });
  const scale = { min, max, step: step > 0 ? step : 1, gap: 0 };
  const [current, setCurrent, fieldName] = useFieldValue<number>({
    value,
    defaultValue: defaultValue ?? min,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : min),
  });
  const shown = snapToStep(current, scale);
  const format = useSliderFormat({ locale, formatOptions, formatValue });
  const submitName = name ?? fieldName;

  return (
    <SliderFrame
      {...props}
      values={[shown]}
      onValuesChange={([next]) => {
        if (next !== undefined) setCurrent(next);
      }}
      onValuesCommit={([next]) => {
        if (next !== undefined) onValueCommit?.(next);
      }}
      scale={scale}
      largeStep={largeStep ?? defaultLargeStep(min, max, scale.step)}
      orientation={orientation}
      disabled={field.disabled === true}
      readOnly={field.readOnly === true}
      invalid={field.invalid}
      marks={marks}
      formatValue={format}
      showValue={showValue}
      thumb={() => ({
        id: field.id,
        "aria-label": ariaLabel,
        // A caller's own name wins; otherwise the Field's label names the thumb.
        "aria-labelledby": ariaLabelledBy ?? (ariaLabel === undefined ? field.labelId : undefined),
        ...field.ariaProps,
      })}
    >
      {submitName !== undefined && <input type="hidden" name={submitName} form={form} value={shown} />}
    </SliderFrame>
  );
}
