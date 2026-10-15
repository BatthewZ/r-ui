"use client";
import { Minus, Plus } from "lucide-react";
import { type ChangeEvent, type FocusEvent, type KeyboardEvent, type MouseEvent, useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber, type FormatNumberOptions } from "../../util/format";
import { composeEventHandlers } from "../../util/merge-props";
import { cn } from "../../util/style";

import { useField } from "./Field";
import { Input, type InputProps } from "./Input";
import { parseLocaleNumber } from "./number-locale";

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
  /** BCP 47 locale for display and for reading typed text. Runtime default when omitted. */
  locale?: string;
  /** Display options, e.g. `{ minimumFractionDigits: 2 }`. Grouping is on by default. */
  formatOptions?: Pick<FormatNumberOptions, "minimumFractionDigits" | "maximumFractionDigits" | "useGrouping">;
  incrementLabel?: string;
  decrementLabel?: string;
}

const MAX_DIGITS = 20;

function decimalsOf(n: number): number {
  const [, fraction = ""] = String(n).split(".");
  return Math.min(fraction.length, MAX_DIGITS);
}

function clamp(n: number, min: number | undefined, max: number | undefined) {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

const roundTo = (n: number, digits: number) => Number(n.toFixed(Math.min(digits, MAX_DIGITS)));

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
  locale,
  formatOptions,
  incrementLabel = "Increase",
  decrementLabel = "Decrease",
  end,
  classNames,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const field = useField();
  const [current, setValue] = useControllableState<number | null>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  // The text being edited, or `null` when the field shows the committed value.
  const [draft, setDraft] = useState<string | null>(null);
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
    return clamp(rounded, min, max);
  };

  const commit = (text: string) => {
    const parsed = parseLocaleNumber(text, locale);
    if (parsed === null) setValue(null);
    else if (!Number.isNaN(parsed)) setValue(settle(parsed));
    // Unreadable text: keep the last good value; leaving the field shows it again.
  };

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
      Enter: () => {
        if (draft !== null && !locked) commit(draft);
      },
    };
    const action = actions[event.key];
    if (!action) return;
    // Home/End without a bound keep their caret meaning.
    if ((event.key === "Home" && min === undefined) || (event.key === "End" && max === undefined)) return;
    if (event.key !== "Enter") event.preventDefault();
    action();
  });

  // Steppers never take focus: keyboard users have the arrow keys, and a
  // press must not blur (and so commit) a half-typed draft first.
  const keepFocus = (event: MouseEvent) => event.preventDefault();
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
      value={draft ?? format(current)}
      onFocus={composeEventHandlers(onFocus, (event: FocusEvent<HTMLInputElement>) => {
        if (!locked) setDraft(event.target.value);
      })}
      onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value))}
      onBlur={composeEventHandlers(onBlur, () => {
        if (draft !== null && !locked) commit(draft);
        setDraft(null);
      })}
      onKeyDown={handleKeyDown}
      classNames={{ ...classNames, input: cn("tabular-nums", classNames?.input), end: cn("self-stretch", classNames?.end) }}
      end={
        <>
          {end != null && <span className="r-form-adornment">{end}</span>}
          <span className="r-form-steppers">
            <button
              type="button"
              tabIndex={-1}
              aria-label={decrementLabel}
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
              aria-label={incrementLabel}
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
