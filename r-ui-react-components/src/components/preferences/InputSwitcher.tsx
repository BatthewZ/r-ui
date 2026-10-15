"use client";
import { useInputMode } from "../../hooks/use-preferences";
import { INPUT_MODES, type InputMode, type PreferencesConfig } from "../../util/preferences";
import { Choice, type SwitcherVariant } from "./Choice";

/** Plain words for the hit floor: "fine" and "coarse" are the media query's, not a viewer's. */
export const DEFAULT_INPUT_LABELS: Record<InputMode, string> = { auto: "Auto", fine: "Pointer", coarse: "Touch" };

export interface InputSwitcherProps extends PreferencesConfig {
  /** `segmented` (default) or `select`. */
  variant?: SwitcherVariant;
  /** The control's accessible name. Default "Input". */
  label?: string;
  /** Each mode's words. */
  labels?: Partial<Record<InputMode, string>>;
  disabled?: boolean;
  className?: string;
}

/**
 * Auto, fine or coarse input for the whole page (`data-input` on `<html>`), saved
 * (`useInputMode`). Coarse raises the hit floor to touch size on any device; auto
 * follows `(pointer: coarse)`.
 */
export function InputSwitcher({
  variant = "segmented",
  label = "Input",
  labels,
  storageKey,
  disabled,
  className,
}: InputSwitcherProps) {
  const { input, setInput } = useInputMode({ storageKey });
  const words = { ...DEFAULT_INPUT_LABELS, ...labels };
  return (
    <Choice
      variant={variant}
      label={label}
      options={INPUT_MODES.map((value) => ({ value, label: words[value] }))}
      value={input}
      onChange={(next) => setInput(next as InputMode)}
      disabled={disabled}
      className={className}
    />
  );
}
