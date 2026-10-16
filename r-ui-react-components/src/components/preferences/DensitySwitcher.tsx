"use client";
import { useDensity } from "../../hooks/use-preferences";
import { type LabelsProp, useLabels } from "../../util/locale";
import { DENSITIES, type Density, type PreferencesConfig } from "../../util/preferences";
import { Choice, type ChoiceOption, type SwitcherHTMLProps, type SwitcherVariant } from "./Choice";
import { DEFAULT_PREFERENCES_MENU_LABELS, type DensitySwitcherLabels } from "./preferences-labels";

/** Every density as a choice, in the given words. */
export function densityOptions(words: Record<Density, string>): ChoiceOption<Density>[] {
  return DENSITIES.map((value) => ({ value, label: words[value] }));
}

export type DensitySwitcherProps = PreferencesConfig &
  SwitcherHTMLProps & {
    /** `segmented` (default) or `select`. */
    variant?: SwitcherVariant;
    /** The control's name (`density`) and each density's words. */
    labels?: LabelsProp<DensitySwitcherLabels>;
    disabled?: boolean;
    className?: string;
  };

/** Comfortable or compact for the whole page (`data-density` on `<html>`), saved (`useDensity`). */
export function DensitySwitcher({
  variant = "segmented",
  labels: labelsProp,
  storageKey,
  disabled,
  className,
  ...passThrough
}: DensitySwitcherProps) {
  const { density, setDensity } = useDensity({ storageKey });
  const labels = useLabels("PreferencesMenu", DEFAULT_PREFERENCES_MENU_LABELS, labelsProp);
  return (
    <Choice
      variant={variant}
      label={labels.density}
      options={densityOptions(labels.densities)}
      value={density}
      onChange={setDensity}
      disabled={disabled}
      className={className}
      passThrough={passThrough}
    />
  );
}
