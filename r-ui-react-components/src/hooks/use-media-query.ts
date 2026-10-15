"use client";
import { useCallback, useSyncExternalStore } from "react";

// `matchMedia` is absent on the server and in some test/headless environments
// (e.g. jsdom) — callers treat those as "no match" rather than throw.
function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * SSR-safe (returns `false` on the server / before hydration) and re-renders
 * the caller as the match state changes.
 *
 * Not for density or input: `useDensity` and `useInputMode` read the
 * `[data-density]` / `[data-input]` the user's choice sets, and a viewport
 * width moves layout only, never density (a container query usually says it
 * better). Reach for this for a preference or capability with no attribute.
 *
 * @example
 * const moreContrast = useMediaQuery("(prefers-contrast: more)");
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!hasMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => (hasMatchMedia() ? window.matchMedia(query).matches : false),
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
