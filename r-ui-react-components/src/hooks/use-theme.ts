"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** The one theme name the design system defines: `:root` with no override layer. */
const DEFAULT_THEME = "default";

/**
 * What `themes` reports when the caller registered none. Module scope so its
 * identity is stable across renders — the snapshot reader memoises on it.
 */
const UNREGISTERED: readonly string[] = [DEFAULT_THEME];

export const STORAGE_KEY = "theme";

/**
 * `themes === null` means the caller registered no list. Then the attribute is
 * reported as-is rather than filtered, because filtering against a list nobody
 * supplied would report every app-defined theme as the default — a mis-report
 * worse than not knowing the set.
 */
function getSnapshotFor<T extends string>(
  themes: readonly T[] | null,
  fallback: T,
): () => T {
  return () => {
    if (typeof document === "undefined") return fallback;
    const attr = document.documentElement.getAttribute("data-theme");
    // An empty or whitespace-only attribute is "unset", not a theme named "".
    // A server template rendering data-theme="{{ theme }}" with the variable
    // missing produces exactly that, and reporting "" back would be a theme no
    // CSS selector can match.
    if (attr === null || attr.trim() === "") return fallback;
    if (themes === null) return attr as T;
    return themes.includes(attr as T) ? (attr as T) : fallback;
  };
}

function subscribe(callback: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === "data-theme") {
        callback();
        break;
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}

export interface UseThemeOptions<T extends string = string> {
  /**
   * The list of themes valid for this app. The first entry is treated as the
   * default (it removes the data-theme attribute when set, instead of writing
   * the value). Any `data-theme` value outside this list reports as the first
   * entry — the list is a registry, so an omission is a mis-report, not a crash.
   */
  themes?: readonly T[];
}

export interface UseThemeReturn<T extends string = string> {
  theme: T;
  setTheme: (next: T) => void;
  themes: readonly T[];
}

/**
 * Theme hook. Reads the current theme from `<html data-theme>` and writes theme
 * changes back. `setTheme` is typed to the themes YOU register — this package
 * has no theme list of its own beyond `default`.
 *
 *     const APP_THEMES = ["default", "aurora", "midnight"] as const;  // module scope
 *     const { theme, setTheme, themes } = useTheme({ themes: APP_THEMES });
 *
 * Declare that array at module scope: the snapshot reader memoises on its
 * identity, so an inline literal re-subscribes on every render.
 *
 * Called with no arguments the hook is registry-free: `theme` is whatever
 * `data-theme` actually says (or `"default"` when unset), `setTheme` accepts any
 * string, and `themes` reports `["default"]` — the only theme the design system
 * itself defines. Register a list when you want `setTheme` typed and unknown
 * values folded to your default.
 *
 * Persistence is not included. `setTheme` _writes_ `localStorage["theme"]` (and
 * clears it for the default theme), but nothing in this package ever reads that
 * key back — so the user's choice is silently discarded on reload. Restoring it
 * before the first paint needs a blocking inline `<script>` in your document
 * `<head>`, which this package does not ship (the showcase's `index.html` has one).
 */
export function useTheme(): UseThemeReturn<string>;
export function useTheme<T extends string>(options: UseThemeOptions<T>): UseThemeReturn<T>;
export function useTheme<T extends string>(
  options?: UseThemeOptions<T>,
): UseThemeReturn<T | string> {
  const registry = options?.themes ?? null;
  const themes = (registry ?? UNREGISTERED) as readonly (T | string)[];
  const fallback = themes[0] ?? DEFAULT_THEME;

  const getSnapshot = useMemo(
    () => getSnapshotFor(registry as readonly string[] | null, fallback as T | string),
    [registry, fallback],
  );

  const theme = useSyncExternalStore(subscribe, getSnapshot, () => fallback as T | string);

  const setTheme = useCallback(
    (next: T | string) => {
      if (typeof document === "undefined") return;
      if (next === fallback) {
        document.documentElement.removeAttribute("data-theme");
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* private browsing */
        }
      } else {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* private browsing */
        }
      }
    },
    [fallback],
  );

  return { theme, setTheme, themes };
}

