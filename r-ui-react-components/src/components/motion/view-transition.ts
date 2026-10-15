"use client";
import { useCallback } from "react";
import { flushSync } from "react-dom";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Runs `update` inside `document.startViewTransition()`, so the browser
 * cross-fades from the old view to the new one (the contract styles the root
 * swap; give an element `view-transition-name` to morph it on its own).
 *
 * Falls back to calling `update` directly where the API is missing and under
 * reduced motion, so callers never branch. The promise settles once the update
 * has been applied, either way (not when the animation ends).
 */
export async function startViewTransition(update: () => void | Promise<void>): Promise<void> {
  const reduced = typeof window !== "undefined" && window.matchMedia?.(REDUCED).matches;
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function" || reduced) {
    await update();
    return;
  }
  const transition = document.startViewTransition(update);
  // A skipped transition (hidden tab, a newer one) rejects `ready`; the update still ran.
  transition.ready.catch(() => {});
  await transition.updateCallbackDone;
}

/**
 * `startViewTransition` for React state: the update is flushed synchronously
 * (`flushSync`), so the browser's "after" snapshot sees the new render.
 *
 * @example
 * const transition = useViewTransition();
 * <Button onClick={() => transition(() => setLayout("grid"))}>Grid</Button>
 */
export function useViewTransition(): (update: () => void) => Promise<void> {
  return useCallback((update: () => void) => startViewTransition(() => flushSync(update)), []);
}
