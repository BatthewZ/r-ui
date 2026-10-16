"use client";
import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";

import { useDensity, useInputMode, useTheme } from "../../hooks/use-preferences";
import { type LabelsProp, useLabels } from "../../util/locale";
import type { PreferencesConfig } from "../../util/preferences";
import type { Placement } from "../../hooks/use-floating";
import { DropdownMenu } from "../overlays";
import { type ChoiceOption, onOptionValue } from "./Choice";
import { densityOptions } from "./DensitySwitcher";
import { inputOptions } from "./InputSwitcher";
import { DEFAULT_PREFERENCES_MENU_LABELS, type PreferencesMenuLabels } from "./preferences-labels";
import { type ThemeOption, toOption } from "./ThemeSwitcher";

export interface PreferencesMenuProps extends PreferencesConfig {
  /** The themes to offer, first = default. Omitted or with one entry: no theme group. */
  themes?: readonly ThemeOption[];
  /** Leave out the density or input group. */
  hide?: readonly ("density" | "input")[];
  labels?: LabelsProp<PreferencesMenuLabels>;
  /** Default "bottom-end": the menu usually sits at the end of a header. */
  placement?: Placement;
  className?: string;
}

/**
 * Theme, density and input in one compact menu (a `DropdownMenu` of radio
 * groups) for a header or toolbar. Choices apply at once, are saved like the
 * switchers', and leave the menu open so a viewer can compare.
 */
export function PreferencesMenu({
  themes = [],
  hide = [],
  labels: labelsProp,
  placement = "bottom-end",
  storageKey,
  className,
}: PreferencesMenuProps) {
  const labels = useLabels("PreferencesMenu", DEFAULT_PREFERENCES_MENU_LABELS, labelsProp);
  const options = themes.map(toOption);
  const { theme, setTheme } = useTheme({ themes: options.map((o) => o.value), storageKey });
  const { density, setDensity } = useDensity({ storageKey });
  const { input, setInput } = useInputMode({ storageKey });
  const id = useId();

  const groups = [
    options.length > 1 && (
      <Group key="theme" id={`${id}-theme`} title={labels.theme} value={theme} onChange={setTheme} options={options} />
    ),
    !hide.includes("density") && (
      <Group
        key="density"
        id={`${id}-density`}
        title={labels.density}
        value={density}
        onChange={setDensity}
        options={densityOptions(labels.densities)}
      />
    ),
    !hide.includes("input") && (
      <Group
        key="input"
        id={`${id}-input`}
        title={labels.input}
        value={input}
        onChange={setInput}
        options={inputOptions(labels.inputs)}
      />
    ),
  ].filter(Boolean);

  return (
    <DropdownMenu placement={placement}>
      <DropdownMenu.Trigger className={className} iconStart={<SlidersHorizontal aria-hidden className="size-icon" />}>
        {labels.trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {groups.flatMap((group, i) => (i === 0 ? [group] : [<DropdownMenu.Separator key={`sep-${i}`} />, group]))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

interface GroupProps<V extends string> {
  id: string;
  title: string;
  value: V;
  onChange: (value: V) => void;
  options: readonly ChoiceOption<V>[];
}

function Group<V extends string>({ id, title, value, onChange, options }: GroupProps<V>) {
  return (
    <>
      <DropdownMenu.Label id={id}>{title}</DropdownMenu.Label>
      <DropdownMenu.RadioGroup aria-labelledby={id} value={value} onValueChange={onOptionValue(options, onChange)}>
        {options.map((o) => (
          <DropdownMenu.RadioItem key={o.value} value={o.value}>
            {o.label}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  );
}
