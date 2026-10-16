"use client";
import { type ComponentPropsWithRef } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import { normalizeThumbs, sameValues, type SliderOrientation } from "./slider-core";
import {
  defaultLargeStep,
  type SliderFormatProps,
  SliderFrame,
  type SliderMark,
  type SliderSlot,
  useSliderFormat,
} from "./slider-parts";

/** `[low, high]`. */
export type RangeSliderValue = [number, number];

/** Every string the control says, for localisation: each thumb's name. */
export interface RangeSliderLabels {
  minimum: string;
  maximum: string;
}

export const DEFAULT_RANGE_SLIDER_LABELS: RangeSliderLabels = {
  minimum: "Minimum",
  maximum: "Maximum",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    RangeSlider: RangeSliderLabels;
  }
}

export interface RangeSliderProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "children">,
    SliderFormatProps {
  value?: RangeSliderValue;
  /** Default `[min, max]`. */
  defaultValue?: RangeSliderValue;
  /** Every change, as it happens. */
  onValueChange?: (value: RangeSliderValue) => void;
  /** Once per gesture that changed the range: on release, or on key up. */
  onValueCommit?: (value: RangeSliderValue) => void;
  /** Default 0. */
  min?: number;
  /** Default 100. */
  max?: number;
  /** Default 1. */
  step?: number;
  /** Page Up/Down and Shift + arrow. Default: a tenth of the scale, on the grid. */
  largeStep?: number;
  /** Steps the thumbs always keep between them. Default 0 (they may meet). */
  minStepsBetweenThumbs?: number;
  marks?: readonly SliderMark[];
  orientation?: SliderOrientation;
  /** Shows each thumb's value in a bubble while it is dragged or keyboard-focused. */
  showValue?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  /** Submitted as two hidden inputs of this name, low then high. Inside a bound Field: the Field's name. */
  name?: string;
  form?: string;
  labels?: LabelsProp<RangeSliderLabels>;
  classNames?: SlotClassNames<SliderSlot>;
}

/**
 * A range on a scale with two thumbs (WAI-ARIA APG multi-thumb slider). The
 * root is a `group` named by the Field's label (or `aria-label`); each thumb is
 * a `role="slider"` named by `labels.minimum` / `labels.maximum`, with its own
 * keys. The thumbs push against each other and never cross: each one's
 * `aria-valuemin`/`aria-valuemax` is the other's value (plus the kept gap).
 */
export function RangeSlider({
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  minStepsBetweenThumbs = 0,
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
  labels: labelsProp,
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: RangeSliderProps) {
  const labels = useLabels("RangeSlider", DEFAULT_RANGE_SLIDER_LABELS, labelsProp);
  const field = useFieldControl({
    id,
    invalid: invalidProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  });
  const safeStep = step > 0 ? step : 1;
  const scale = { min, max, step: safeStep, gap: Math.max(0, minStepsBetweenThumbs) * safeStep };
  const [current, setCurrent, fieldName] = useFieldValue<RangeSliderValue>({
    value,
    defaultValue: defaultValue ?? [min, max],
    onChange: onValueChange,
    isEqual: sameValues,
    fromForm: (raw) =>
      Array.isArray(raw) && raw.length === 2 && raw.every((n) => typeof n === "number" && Number.isFinite(n))
        ? [raw[0] as number, raw[1] as number]
        : [min, max],
  });
  const [low = min, high = max] = normalizeThumbs(current, scale);
  const format = useSliderFormat({ locale, formatOptions, formatValue });
  const submitName = name ?? fieldName;
  const pair = (next: readonly number[]): RangeSliderValue => [next[0] ?? min, next[1] ?? max];

  return (
    <SliderFrame
      role="group"
      id={field.id}
      aria-labelledby={ariaLabelledBy ?? (props["aria-label"] === undefined ? field.labelId : undefined)}
      {...props}
      values={[low, high]}
      onValuesChange={(next) => setCurrent(pair(next))}
      onValuesCommit={(next) => onValueCommit?.(pair(next))}
      scale={scale}
      largeStep={largeStep ?? defaultLargeStep(min, max, safeStep)}
      orientation={orientation}
      disabled={field.disabled === true}
      readOnly={field.readOnly === true}
      invalid={field.invalid}
      marks={marks}
      formatValue={format}
      showValue={showValue}
      thumb={(index) => ({ "aria-label": index === 0 ? labels.minimum : labels.maximum, ...field.ariaProps })}
    >
      {submitName !== undefined && (
        <>
          <input type="hidden" name={submitName} form={form} value={low} />
          <input type="hidden" name={submitName} form={form} value={high} />
        </>
      )}
    </SliderFrame>
  );
}
