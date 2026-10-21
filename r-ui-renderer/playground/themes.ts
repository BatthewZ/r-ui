/**
 * The playground's theme list, as a consumer app configures the library's
 * preferences API. The playground is a consumer: it chose to import the CSS
 * package's example themes (themes.css), so it lists them here, and this
 * module and themes.css are the only places that name them.
 *
 * No React here, and no runtime imports: vite.config.ts imports it.
 */
import type { ThemeConfig } from "@batthewz/r-ui-react-components";

export const STORAGE_KEY = "r-ui-renderer-playground:view";

export const THEMES = [
  { value: "default", label: "Default" },
  { value: "nightfall", label: "Nightfall" },
  { value: "harbour", label: "Harbour" },
  { value: "atelier", label: "Atelier" },
] as const;

/** What the switchers and the pre-paint script receive. */
export const PREFERENCES = {
  storageKey: STORAGE_KEY,
  themes: THEMES.map((theme) => theme.value),
} satisfies ThemeConfig;
