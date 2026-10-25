/**
 * The viewer's preferences: theme, density and input, each one attribute on
 * `<html>`, saved together as one JSON object in `localStorage`.
 *
 *   theme   -> data-theme    (absent = the default theme, `:root`)
 *   density -> data-density  (absent = comfortable, the `:root` default)
 *   input   -> data-input    (absent = auto, i.e. `@media (pointer: coarse)`)
 *
 * The same reader and applier run in two places: the pre-paint script
 * (`themeScript`, `<ThemeScript>`), which restores the saved choice before the
 * first paint, and the hooks (`useTheme`, `useDensity`, `useInputMode`), which
 * restore it on mount when there is no script and write every change back.
 * No React here: a build step (a Vite plugin, a server template) can import it.
 */

export const DENSITIES = ["comfortable", "compact"] as const;
export const INPUT_MODES = ["auto", "fine", "coarse"] as const;

export type Density = (typeof DENSITIES)[number];
export type InputMode = (typeof INPUT_MODES)[number];

export interface Preferences {
  theme: string;
  density: Density;
  input: InputMode;
}

/** The one theme name the design system defines: `:root` with no override layer. */
export const DEFAULT_THEME = "default";

/** Where the preferences are saved unless `storageKey` says otherwise. */
export const PREFERENCES_STORAGE_KEY = "r-ui:preferences";

export interface PreferencesConfig {
  /** The `localStorage` key holding the saved preferences. Default `"r-ui:preferences"`. */
  storageKey?: string;
}

export interface ThemeConfig<T extends string = string> extends PreferencesConfig {
  /**
   * The themes this app ships. The first is the default (`:root`; choosing it
   * removes `data-theme`). A saved or attribute value outside the list is
   * ignored. Omitted: any non-empty name is accepted and `"default"` is the
   * default.
   */
  themes?: readonly T[];
}

/*
 * readStoredPreferences and applyPreferences are serialised into the pre-paint
 * script with Function#toString, so each must stay self-contained: no imports,
 * no module constants, no helpers outside its own body.
 */

/**
 * The saved preferences, each field validated on its own: a missing, unknown or
 * unreadable field is absent, never a guess. Storage that throws (blocked,
 * private mode) or holds malformed JSON reads as nothing saved.
 */
export function readStoredPreferences(
  storageKey: string,
  themes: readonly string[] | null,
): Partial<Preferences> {
  const out: Partial<Preferences> = {};
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (!raw || typeof raw !== "object") return out;
    const saved = raw as Record<string, unknown>;
    const theme = saved.theme;
    if (typeof theme === "string" && theme.trim() !== "" && (!themes || themes.indexOf(theme) >= 0)) {
      out.theme = theme;
    }
    if (saved.density === "comfortable" || saved.density === "compact") out.density = saved.density;
    if (saved.input === "auto" || saved.input === "fine" || saved.input === "coarse") out.input = saved.input;
  } catch {
    /* unreadable storage is "nothing saved" */
  }
  return out;
}

/**
 * Writes each given preference to its attribute on `root`. A default (the
 * `defaultTheme`, comfortable, auto) removes the attribute, so `:root` and the
 * media query decide, exactly as with nothing set.
 */
export function applyPreferences(
  preferences: Partial<Preferences>,
  defaultTheme: string,
  root: HTMLElement,
): void {
  const theme = preferences.theme;
  if (theme !== undefined) {
    if (theme === defaultTheme) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }
  if (preferences.density === "compact") root.setAttribute("data-density", "compact");
  else if (preferences.density === "comfortable") root.removeAttribute("data-density");
  if (preferences.input === "fine" || preferences.input === "coarse") root.setAttribute("data-input", preferences.input);
  else if (preferences.input === "auto") root.removeAttribute("data-input");
}

/**
 * Saves `patch` over what is stored (one JSON object for all three axes).
 * Storage that throws is ignored: the choice still applies for this page view.
 */
export function storePreferences(storageKey: string, patch: Partial<Preferences>): void {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    const current = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    window.localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* blocked or full storage: the attribute is already set */
  }
}

/** JSON that is also safe inside an HTML `<script>` (no `</script>` breakout). */
function scriptLiteral(value: unknown): string {
  // `<` closes the script element; U+2028/9 end a line in older JS parsers.
  return JSON.stringify(value).replace(/[<\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/**
 * The reader and applier as source text, for the pre-paint script. The library
 * build replaces this with the text it compiled (vite.config.ts), so the script is
 * the same in every app whatever bundler or minifier it uses, and a
 * Content-Security-Policy hash of it holds. From source (tests, a dev server) it
 * is read at run time.
 */
declare const __R_UI_PREFERENCES_SOURCE__: { read: string; apply: string } | undefined;

function preferencesSource(): { read: string; apply: string } {
  return typeof __R_UI_PREFERENCES_SOURCE__ === "undefined"
    ? { read: readStoredPreferences.toString(), apply: applyPreferences.toString() }
    : __R_UI_PREFERENCES_SOURCE__;
}

/**
 * The body of a blocking inline `<script>` for the document `<head>`: it applies
 * the saved theme, density and input to `<html>` before the first paint, so a
 * reload never flashes the default. Pass the same `storageKey` and `themes` the
 * hooks use. Everything runs inside try/catch: blocked storage or a bad value
 * leaves the page on its defaults.
 *
 *     <script>{themeScript({ themes: ["default", "aurora"] })}</script>
 *
 * React renders `<ThemeScript>` to the same thing. For a given config the text
 * is the same in every app, so a CSP may allow it by hash (or pass `nonce` to
 * `<ThemeScript>`).
 */
export function themeScript({ storageKey = PREFERENCES_STORAGE_KEY, themes }: ThemeConfig = {}): string {
  const args = [scriptLiteral(storageKey), scriptLiteral(themes ?? null), scriptLiteral(themes?.[0] ?? DEFAULT_THEME)];
  const source = preferencesSource();
  return (
    "(function(){try{" +
    `var read=${source.read};` +
    `var apply=${source.apply};` +
    `apply(read(${args[0]},${args[1]}),${args[2]},document.documentElement);` +
    "}catch(e){}})();"
  );
}
