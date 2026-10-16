"use client";
import { Minus, Plus } from "lucide-react";
import { type ChangeEvent, type FocusEvent, type KeyboardEvent } from "react";

import { formatNumber, type FormatNumberOptions } from "../../util/format";
import { composeEventHandlers } from "../../util/merge-props";
import { cn } from "../../util/style";

import { useField, useFieldValue } from "./Field";
import { Input, type InputProps, keepFocus } from "./Input";
import { clampNumber, MAX_DIGITS, roundTo, useNumberDraft } from "./number-draft";
import { parseLocaleNumber } from "./number-locale";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";

export interface NumberInputProps
  extends Omit<InputProps, "type" | "value" | "defaultValue" | "inputMode" | "role" | "min" | "max" | "step"> {
  /** `null` is an empty field. */
  value?: number | null;
  defaultValue?: number | null;
  /** The committed number: on blur, Enter, a step or a stepper press; never mid-typing. */
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Arrow keys and steppers move by `step`; PageUp/PageDown by ten steps. */
  step?: number;
  /** Fraction digits a committed value is rounded to. Unrounded when omitted. */
  precision?: number;
  /** BCP 47 locale for display and for reading typed text. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** Display options, e.g. `{ minimumFractionDigits: 2 }`. Grouping is on by default. */
  formatOptions?: Pick<FormatNumberOptions, "minimumFractionDigits" | "maximumFractionDigits" | "useGrouping">;
  labels?: LabelsProp<NumberInputLabels>;
}

/** Every string the control says, for localisation: the steppers' names. */
export interface NumberInputLabels {
  increment: string;
  decrement: string;
}

export const DEFAULT_NUMBER_INPUT_LABELS: NumberInputLabels = {
  increment: "Increase",
  decrement: "Decrease",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    NumberInput: NumberInputLabels;
  }
}

function decimalsOf(n: number): number {
  const [, fraction = ""] = String(n).split(".");
  return Math.min(fraction.length, MAX_DIGITS);
}

/**
 * A number field with steppers. ARIA `spinbutton`: ArrowUp/Down step,
 * PageUp/PageDown step ten, Home/End jump to `min`/`max`. Typed text is read
 * in `locale` and committed on blur or Enter; display is locale-formatted with
 * tabular figures. Unreadable text reverts; an empty field commits `null`.
 */
export function NumberInput({
  value,
  defaultValue = null,
  onValueChange,
  min,
  max,
  step = 1,
  precision,
  locale: localeProp,
  formatOptions,
  labels: labelsProp,
  end,
  classNames,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const labels = useLabels("NumberInput", DEFAULT_NUMBER_INPUT_LABELS, labelsProp);
  const locale = useLocale(localeProp);
  const field = useField();
  // In a Field bound to a Form, the form owns the number (unless the caller passed one).
  const [current, setValue] = useFieldValue<number | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : null),
  });
  const locked =
    (props.disabled ?? field?.disabled) === true || (props.readOnly ?? field?.readOnly) === true;

  const format = (n: number | null) =>
    formatNumber(n, {
      locale,
      maximumFractionDigits: precision ?? MAX_DIGITS,
      ...formatOptions,
      missing: "",
    });

  const settle = (n: number) => {
    const rounded = precision === undefined ? n : roundTo(n, precision);
    return clampNumber(rounded, min, max);
  };

  const { draft, setDraft, text, commitDraft, ...edit } = useNumberDraft({
    current,
    setValue,
    format,
    parse: (typed) => parseLocaleNumber(typed, locale),
    settle,
    locked,
  });

  const stepBy = (steps: number) => {
    if (locked) return;
    // Step from the text in the box when it reads; from the committed value
    // when it does not. An empty field seeds at 0 and the clamp carries it to
    // a bound, so the first press in a `min={10}` field lands on 10.
    const typed = draft === null ? current : parseLocaleNumber(draft, locale);
    const base = typed === null ? 0 : Number.isNaN(typed) ? (current ?? 0) : typed;
    const next = settle(roundTo(base + steps * step, Math.max(decimalsOf(base), decimalsOf(step))));
    setValue(next);
    if (draft !== null) setDraft(format(next));
  };

  const jumpTo = (bound: number | undefined) => {
    if (locked || bound === undefined) return;
    setValue(bound);
    if (draft !== null) setDraft(format(bound));
  };

  const handleKeyDown = composeEventHandlers(onKeyDown, (event: KeyboardEvent<HTMLInputElement>) => {
    const actions: Record<string, () => void> = {
      ArrowUp: () => stepBy(1),
      ArrowDown: () => stepBy(-1),
      PageUp: () => stepBy(10),
      PageDown: () => stepBy(-10),
      Home: () => jumpTo(min),
      End: () => jumpTo(max),
      Enter: commitDraft,
    };
    const action = actions[event.key];
    if (!action) return;
    // Home/End without a bound keep their caret meaning.
    if ((event.key === "Home" && min === undefined) || (event.key === "End" && max === undefined)) return;
    if (event.key !== "Enter") event.preventDefault();
    action();
  });

  const atMin = current !== null && min !== undefined && current <= min;
  const atMax = current !== null && max !== undefined && current >= max;

  return (
    <Input
      {...props}
      type="text"
      inputMode={step % 1 === 0 && (min === undefined || min >= 0) ? "numeric" : "decimal"}
      role="spinbutton"
      autoComplete="off"
      aria-valuenow={current ?? undefined}
      aria-valuetext={current === null ? undefined : format(current)}
      aria-valuemin={min}
      aria-valuemax={max}
      value={text}
      onFocus={composeEventHandlers(onFocus, (event: FocusEvent<HTMLInputElement>) => edit.onFocus(event.target.value))}
      onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => edit.onChange(event.target.value))}
      onBlur={composeEventHandlers(onBlur, edit.onBlur)}
      onKeyDown={handleKeyDown}
      classNames={{ ...classNames, input: cn("tabular-nums", classNames?.input), end: cn("self-stretch", classNames?.end) }}
      end={
        <>
          {end != null && <span className="r-form-adornment">{end}</span>}
          {/* Steppers never take focus: keyboard users have the arrow keys, and a
              press must not blur (and so commit) a half-typed draft first. */}
          <span className="r-form-steppers">
            <button
              type="button"
              tabIndex={-1}
              aria-label={labels.decrement}
              disabled={locked || atMin}
              onMouseDown={keepFocus}
              onClick={() => stepBy(-1)}
              className="r-form-stepper"
            >
              <Minus aria-hidden />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={labels.increment}
              disabled={locked || atMax}
              onMouseDown={keepFocus}
              onClick={() => stepBy(1)}
              className="r-form-stepper"
            >
              <Plus aria-hidden />
            </button>
          </span>
        </>
      }
    />
  );
}
