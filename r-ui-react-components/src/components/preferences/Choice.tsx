"use client";
import type { ReactNode } from "react";

import { cn } from "../../util/style";
import { SegmentedControl, Select } from "../form";

export interface ChoiceOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/** How a switcher draws its choices: segments (all visible) or a native select (compact, any count). */
export type SwitcherVariant = "segmented" | "select";

export interface ChoiceProps {
  variant: SwitcherVariant;
  /** The control's accessible name. */
  label: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** The one control behind every switcher, so the three look and behave alike. */
export function Choice({ variant, label, options, value, onChange, disabled, className }: ChoiceProps) {
  if (variant === "select") {
    return (
      <Select
        aria-label={label}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(event) => onChange(event.target.value)}
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
      onValueChange={onChange}
      disabled={disabled}
      className={cn("max-w-full", className)}
    >
      {options.map((o) => (
        <SegmentedControl.Item key={o.value} value={o.value} icon={o.icon}>
          {o.label}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl>
  );
}
