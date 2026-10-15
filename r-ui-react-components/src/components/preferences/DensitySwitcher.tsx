"use client";
import { useDensity } from "../../hooks/use-preferences";
import { DENSITIES, type Density, type PreferencesConfig } from "../../util/preferences";
import { Choice, type SwitcherVariant } from "./Choice";

export const DEFAULT_DENSITY_LABELS: Record<Density, string> = { comfortable: "Comfortable", compact: "Compact" };

export interface DensitySwitcherProps extends PreferencesConfig {
  /** `segmented` (default) or `select`. */
  variant?: SwitcherVariant;
  /** The control's accessible name. Default "Density". */
  label?: string;
  /** Each density's words. */
  labels?: Partial<Record<Density, string>>;
  disabled?: boolean;
  className?: string;
}

/** Comfortable or compact for the whole page (`data-density` on `<html>`), saved (`useDensity`). */
export function DensitySwitcher({
  variant = "segmented",
  label = "Density",
  labels,
  storageKey,
  disabled,
  className,
}: DensitySwitcherProps) {
  const { density, setDensity } = useDensity({ storageKey });
  const words = { ...DEFAULT_DENSITY_LABELS, ...labels };
  return (
    <Choice
      variant={variant}
      label={label}
      options={DENSITIES.map((value) => ({ value, label: words[value] }))}
      value={density}
      onChange={(next) => setDensity(next as Density)}
      disabled={disabled}
      className={className}
    />
  );
}
