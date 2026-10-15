import type { Density, InputMode } from "../../util/preferences";

/** Every word the preference controls write: one set, shared by the switchers and the menu. */
export interface PreferencesMenuLabels {
  /** The menu trigger's text. */
  trigger: string;
  /** The theme control's (or menu group's) name. */
  theme: string;
  /** The density control's (or menu group's) name. */
  density: string;
  /** The input control's (or menu group's) name. */
  input: string;
  densities: Record<Density, string>;
  /** Plain words for the hit floor: "fine" and "coarse" are the media query's, not a viewer's. */
  inputs: Record<InputMode, string>;
}

export const DEFAULT_PREFERENCES_MENU_LABELS: PreferencesMenuLabels = {
  trigger: "View",
  theme: "Theme",
  density: "Density",
  input: "Input",
  densities: { comfortable: "Comfortable", compact: "Compact" },
  inputs: { auto: "Auto", fine: "Pointer", coarse: "Touch" },
};

export type ThemeSwitcherLabels = Pick<PreferencesMenuLabels, "theme">;
export type DensitySwitcherLabels = Pick<PreferencesMenuLabels, "density" | "densities">;
export type InputSwitcherLabels = Pick<PreferencesMenuLabels, "input" | "inputs">;
