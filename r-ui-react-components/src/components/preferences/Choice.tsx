"use client";
import type { AriaAttributes, ReactNode, Ref } from "react";

import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { SegmentedControl, Select } from "../form";

export interface ChoiceOption<V extends string = string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

/** How a switcher draws its choices: segments (all visible) or a native select (compact, any count). */
export type SwitcherVariant = "segmented" | "select";

/**
 * What a switcher passes on to its control (the radiogroup, or the native
 * select): an id for a `<label htmlFor>`, a ref, ARIA (a caller's `aria-label`
 * names this instance over the default) and `data-*` hooks.
 */
export type SwitcherHTMLProps = {
  id?: string;
  ref?: Ref<HTMLElement>;
} & AriaAttributes & { [data: `data-${string}`]: string | number | boolean | undefined };

export interface ChoiceProps<V extends string> {
  variant: SwitcherVariant;
  /** The control's accessible name. */
  label: string;
  options: readonly ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  className?: string;
  /** Spread onto the control, after the defaults. */
  passThrough?: SwitcherHTMLProps;
}

/**
 * A handler for the value a control reports, as a string, that calls `onChange`
 * with the option it names (typed, no cast) and ignores anything else.
 */
export function onOptionValue<V extends string>(
  options: readonly ChoiceOption<V>[],
  onChange: (value: V) => void,
): (raw: string) => void {
  return (raw) => {
    const option = options.find((o) => o.value === raw);
    if (option) onChange(option.value);
  };
}

/** The one control behind every switcher, so the three look and behave alike. */
export function Choice<V extends string>({
  variant,
  label,
  options,
  value,
  onChange,
  disabled,
  className,
  passThrough: { ref, ...passThrough } = {},
}: ChoiceProps<V>) {
  const choose = onOptionValue(options, onChange);
  // Either control's element is an HTMLElement; a callback ref takes both.
  const controlRef = ref ? mergeRefs<HTMLElement>(ref) : undefined;
  if (variant === "select") {
    return (
      <Select
        aria-label={label}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(event) => choose(event.target.value)}
        {...passThrough}
        ref={controlRef}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <SegmentedControl
      aria-label={label}
      value={value}
      onValueChange={choose}
      disabled={disabled}
      className={cn("max-w-full", className)}
      {...passThrough}
      ref={controlRef}
    >
      {options.map((o) => (
        <SegmentedControl.Item key={o.value} value={o.value} icon={o.icon}>
          {o.label}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl>
  );
}
