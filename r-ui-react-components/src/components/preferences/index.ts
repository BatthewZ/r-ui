// Preferences: the viewer's theme, density and input, applied to <html> and saved.
// Owned by the "preferences" group: add one export line per component.
export { DensitySwitcher, type DensitySwitcherProps } from "./DensitySwitcher";
export { InputSwitcher, type InputSwitcherProps } from "./InputSwitcher";
export { PreferencesMenu, type PreferencesMenuProps } from "./PreferencesMenu";
export {
  DEFAULT_PREFERENCES_MENU_LABELS,
  type DensitySwitcherLabels,
  type InputSwitcherLabels,
  type PreferencesMenuLabels,
  type ThemeSwitcherLabels,
} from "./preferences-labels";
export { ThemeScript, type ThemeScriptProps } from "./ThemeScript";
export { type ThemeOption, ThemeSwitcher, type ThemeSwitcherProps } from "./ThemeSwitcher";
export type { SwitcherHTMLProps, SwitcherVariant } from "./Choice";
export {
  applyPreferences,
  DENSITIES,
  type Density,
  INPUT_MODES,
  type InputMode,
  type Preferences,
  type PreferencesConfig,
  PREFERENCES_STORAGE_KEY,
  readStoredPreferences,
  storePreferences,
  type ThemeConfig,
  themeScript,
} from "../../util/preferences";
