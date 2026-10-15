"use client";
import { useMediaQuery } from "./use-media-query";

/** The media query behind the reduced-motion preference. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
