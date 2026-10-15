"use client";
import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";

import {
  applyPreferences,
  DEFAULT_THEME,
  type Density,
  type InputMode,
  type Preferences,
  type PreferencesConfig,
  PREFERENCES_STORAGE_KEY,
  readStoredPreferences,
  storePreferences,
  type ThemeConfig,
} from "../util/preferences";
import { useMediaQuery } from "./use-media-query";

/*
 * Each preference is one attribute on <html>, so <html> is the store: every
 * hook instance reads the attribute and hears its changes, and the pre-paint
 * script, a hand-set attribute and a sibling switcher all stay in step.
 */

type Attribute = "data-theme" | "data-density" | "data-input";

function subscribeTo(attribute: Attribute) {
  return (callback: () => void) => {
    if (typeof document === "undefined") return () => {};
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
    return () => observer.disconnect();
  };
}

const subscribeTheme = subscribeTo("data-theme");
const subscribeDensity = subscribeTo("data-density");
const subscribeInput = subscribeTo("data-input");

const rootAttribute = (attribute: Attribute) =>
  typeof document === "undefined" ? null : document.documentElement.getAttribute(attribute);

/**
 * Restores the saved value on mount (before paint), for apps without the
 * pre-paint script; with it, the attribute is already right and this is a no-op.
 */
function useRestore(storageKey: string, key: keyof Preferences, themes: readonly string[] | null, defaultTheme: string) {
  const themesKey = themes?.join("\u0000") ?? null;
  useLayoutEffect(() => {
    const saved = readStoredPreferences(storageKey, themes)[key];
    if (saved !== undefined) applyPreferences({ [key]: saved }, defaultTheme, document.documentElement);
    // Keyed on the list's content, so an inline array literal does not re-run this.
  }, [storageKey, key, themesKey, defaultTheme]);
}

function useSetter<V extends string>(storageKey: string, key: keyof Preferences, defaultTheme: string) {
  return useCallback(
    (next: V) => {
      if (typeof document === "undefined") return;
      applyPreferences({ [key]: next }, defaultTheme, document.documentElement);
      storePreferences(storageKey, { [key]: next });
    },
    [storageKey, key, defaultTheme],
  );
}

/* ─── Theme ────────────────────────────────────────────────────────────── */

/** What `themes` reports when the caller registered none. Module scope: a stable identity. */
const UNREGISTERED: readonly string[] = [DEFAULT_THEME];

export type UseThemeOptions<T extends string = string> = ThemeConfig<T>;

export interface UseThemeReturn<T extends string = string> {
  theme: T;
  /** Applies the theme to `<html>` and saves it, so a reload (and `ThemeScript`) restores it. */
  setTheme: (next: T) => void;
  themes: readonly T[];
}

/**
 * The page's theme: read from `<html data-theme>`, written back there and saved
 * under `storageKey`. On mount it restores the saved theme (before paint);
 * render `ThemeScript` in the document head to restore it before the FIRST
 * paint too, with no flash.
 *
 *     const { theme, setTheme, themes } = useTheme({ themes: ["default", "aurora", "midnight"] });
 *
 * Register your themes to type `setTheme` and fold unknown values to your
 * default (the first entry). Called with no list the hook is registry-free:
 * `theme` is whatever `data-theme` says (or `"default"` when unset), and
 * `themes` reports `["default"]`, the only theme the design system defines.
 */
export function useTheme(): UseThemeReturn<string>;
export function useTheme<T extends string>(options: UseThemeOptions<T>): UseThemeReturn<T>;
export function useTheme<T extends string>(options: UseThemeOptions<T> = {}): UseThemeReturn<T | string> {
  const { storageKey = PREFERENCES_STORAGE_KEY } = options;
  const registry = (options.themes ?? null) as readonly string[] | null;
  const registryKey = registry?.join("\u0000") ?? null;
  const fallback = registry?.[0] ?? DEFAULT_THEME;

  const getSnapshot = useMemo(
    () => () => {
      const attr = rootAttribute("data-theme");
      // An empty attribute is "unset" (a template that rendered a missing variable), not a theme named "".
      if (attr === null || attr.trim() === "") return fallback;
      if (registry === null) return attr;
      return registry.includes(attr) ? attr : fallback;
    },
    // Content key: an inline `themes` literal must not resubscribe every render.
    [registryKey, fallback],
  );
  const theme = useSyncExternalStore(subscribeTheme, getSnapshot, () => fallback);

  useRestore(storageKey, "theme", registry, fallback);
  const setTheme = useSetter<string>(storageKey, "theme", fallback);

  return { theme, setTheme, themes: (options.themes ?? UNREGISTERED) as readonly string[] };
}

/* ─── Density ──────────────────────────────────────────────────────────── */

export interface UseDensityReturn {
  density: Density;
  /** Sets `data-density` on `<html>` (comfortable removes it) and saves it. */
  setDensity: (next: Density) => void;
}

const readDensity = (): Density => (rootAttribute("data-density") === "compact" ? "compact" : "comfortable");

/** The page's density, from `<html data-density>`; saved and restored like `useTheme`. */
export function useDensity({ storageKey = PREFERENCES_STORAGE_KEY }: PreferencesConfig = {}): UseDensityReturn {
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => "comfortable" as const);
  useRestore(storageKey, "density", null, DEFAULT_THEME);
  const setDensity = useSetter<Density>(storageKey, "density", DEFAULT_THEME);
  return { density, setDensity };
}

/* ─── Input ────────────────────────────────────────────────────────────── */

export interface UseInputModeReturn {
  /** The choice: `auto` follows the pointer media query; `fine` / `coarse` force it. */
  input: InputMode;
  /** Sets `data-input` on `<html>` (auto removes it) and saves it. */
  setInput: (next: InputMode) => void;
  /** What applies right now: the forced mode, or what `(pointer: coarse)` says under auto. */
  resolved: Exclude<InputMode, "auto">;
}

const readInput = (): InputMode => {
  const attr = rootAttribute("data-input");
  return attr === "fine" || attr === "coarse" ? attr : "auto";
};

/** The page's input mode (hit floor), from `<html data-input>`; saved and restored like `useTheme`. */
export function useInputMode({ storageKey = PREFERENCES_STORAGE_KEY }: PreferencesConfig = {}): UseInputModeReturn {
  const input = useSyncExternalStore(subscribeInput, readInput, () => "auto" as const);
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  useRestore(storageKey, "input", null, DEFAULT_THEME);
  const setInput = useSetter<InputMode>(storageKey, "input", DEFAULT_THEME);
  return { input, setInput, resolved: input === "auto" ? (coarsePointer ? "coarse" : "fine") : input };
}
