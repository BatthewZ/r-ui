"use client";
import { useMediaQuery } from "./use-media-query";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the user has asked their OS for reduced motion.
 *
 * A thin alias over {@link useMediaQuery}, which already guards the absence of
 * `matchMedia` — the server, jsdom, and headless runners all report "no
 * preference" rather than throwing.
 *
 * @example
 * const reduced = usePrefersReducedMotion();
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
