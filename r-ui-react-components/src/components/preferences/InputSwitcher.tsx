"use client";
import { useInputMode } from "../../hooks/use-preferences";
import { type LabelsProp, mergeLabels } from "../../util/labels";
import { INPUT_MODES, type InputMode, type PreferencesConfig } from "../../util/preferences";
import { Choice, type ChoiceOption, type SwitcherHTMLProps, type SwitcherVariant } from "./Choice";
import { DEFAULT_PREFERENCES_MENU_LABELS, type InputSwitcherLabels } from "./preferences-labels";

/** Every input mode as a choice, in the given words. */
export function inputOptions(words: Record<InputMode, string>): ChoiceOption<InputMode>[] {
  return INPUT_MODES.map((value) => ({ value, label: words[value] }));
}

export type InputSwitcherProps = PreferencesConfig &
  SwitcherHTMLProps & {
    /** `segmented` (default) or `select`. */
    variant?: SwitcherVariant;
    /** The control's name (`input`) and each mode's words. */
    labels?: LabelsProp<InputSwitcherLabels>;
    disabled?: boolean;
    className?: string;
  };

/**
 * Auto, fine or coarse input for the whole page (`data-input` on `<html>`), saved
 * (`useInputMode`). Coarse raises the hit floor to touch size on any device; auto
 * follows `(pointer: coarse)`.
 */
export function InputSwitcher({
  variant = "segmented",
  labels: labelsProp,
  storageKey,
  disabled,
  className,
  ...passThrough
}: InputSwitcherProps) {
  const { input, setInput } = useInputMode({ storageKey });
  const labels = mergeLabels(DEFAULT_PREFERENCES_MENU_LABELS, labelsProp);
  return (
    <Choice
      variant={variant}
      label={labels.input}
      options={inputOptions(labels.inputs)}
      value={input}
      onChange={setInput}
      disabled={disabled}
      className={className}
      passThrough={passThrough}
    />
  );
}
