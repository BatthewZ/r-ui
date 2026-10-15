"use client";
import { useMemo } from "react";

import { useTheme } from "../../hooks/use-preferences";
import type { PreferencesConfig } from "../../util/preferences";
import { Choice, type ChoiceOption, type SwitcherVariant } from "./Choice";

/** A theme the app ships: its `data-theme` name and the words a viewer sees. A bare string is both. */
export type ThemeOption = string | ChoiceOption;

export interface ThemeSwitcherProps extends PreferencesConfig {
  /**
   * The themes to offer, in order. The FIRST is the default (`:root`; choosing
   * it removes `data-theme`). This library ships no list: pass your own.
   */
  themes: readonly ThemeOption[];
  /** `segmented` (default) shows every theme; `select` suits a long list or a tight space. */
  variant?: SwitcherVariant;
  /** The control's accessible name. Default "Theme". */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const toOption = (theme: ThemeOption): ChoiceOption =>
  typeof theme === "string" ? { value: theme, label: theme } : theme;

/**
 * Picks the page's theme from the consumer's list, applies it to `<html>` and
 * saves it (`useTheme`). Pair it with `ThemeScript` (same `themes` and
 * `storageKey`) so a reload restores the choice before the first paint.
 */
export function ThemeSwitcher({
  themes,
  variant = "segmented",
  label = "Theme",
  storageKey,
  disabled,
  className,
}: ThemeSwitcherProps) {
  const options = useMemo(() => themes.map(toOption), [themes]);
  const values = useMemo(() => options.map((o) => o.value), [options]);
  const { theme, setTheme } = useTheme({ themes: values, storageKey });
  return (
    <Choice
      variant={variant}
      label={label}
      options={options}
      value={theme}
      onChange={setTheme}
      disabled={disabled}
      className={className}
    />
  );
}
