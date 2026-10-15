"use client";
import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";

import { useDensity, useInputMode, useTheme } from "../../hooks/use-preferences";
import { DENSITIES, type Density, INPUT_MODES, type InputMode, type PreferencesConfig } from "../../util/preferences";
import type { Placement } from "../../hooks/use-floating";
import { DropdownMenu } from "../overlays";
import { DEFAULT_DENSITY_LABELS } from "./DensitySwitcher";
import { DEFAULT_INPUT_LABELS } from "./InputSwitcher";
import { type ThemeOption, toOption } from "./ThemeSwitcher";

export interface PreferencesMenuLabels {
  /** The trigger's text. Default "View". */
  trigger: string;
  theme: string;
  density: string;
  input: string;
  densities: Partial<Record<Density, string>>;
  inputs: Partial<Record<InputMode, string>>;
}

const DEFAULT_LABELS: Omit<PreferencesMenuLabels, "densities" | "inputs"> = {
  trigger: "View",
  theme: "Theme",
  density: "Density",
  input: "Input",
};

export interface PreferencesMenuProps extends PreferencesConfig {
  /** The themes to offer, first = default. Omitted or with one entry: no theme group. */
  themes?: readonly ThemeOption[];
  /** Leave out the density or input group. */
  hide?: readonly ("density" | "input")[];
  labels?: Partial<PreferencesMenuLabels>;
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
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const densityWords = { ...DEFAULT_DENSITY_LABELS, ...labelsProp?.densities };
  const inputWords = { ...DEFAULT_INPUT_LABELS, ...labelsProp?.inputs };
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
        onChange={(v) => setDensity(v as Density)}
        options={DENSITIES.map((value) => ({ value, label: densityWords[value] }))}
      />
    ),
    !hide.includes("input") && (
      <Group
        key="input"
        id={`${id}-input`}
        title={labels.input}
        value={input}
        onChange={(v) => setInput(v as InputMode)}
        options={INPUT_MODES.map((value) => ({ value, label: inputWords[value] }))}
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

interface GroupProps {
  id: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}

function Group({ id, title, value, onChange, options }: GroupProps) {
  return (
    <>
      <DropdownMenu.Label id={id}>{title}</DropdownMenu.Label>
      <DropdownMenu.RadioGroup aria-labelledby={id} value={value} onValueChange={onChange}>
        {options.map((o) => (
          <DropdownMenu.RadioItem key={o.value} value={o.value}>
            {o.label}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  );
}
