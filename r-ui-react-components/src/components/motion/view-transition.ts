"use client";
import { useCallback } from "react";
import { flushSync } from "react-dom";

import { REDUCED_MOTION_QUERY } from "../../hooks/use-reduced-motion";

/**
 * A running view transition. The promise itself settles once the update has
 * applied (it rejects only if the update throws); `finished` settles when the
 * animation has ended, or right after the update when the transition was
 * skipped, and never rejects.
 */
export type ViewTransitionRun = Promise<void> & { finished: Promise<void> };

const noop = () => {};

/**
 * Runs `update` inside `document.startViewTransition()`, so the browser
 * cross-fades from the old view to the new one (the contract styles the root
 * swap; give an element `view-transition-name` to morph it on its own).
 *
 * Falls back to calling `update` directly (synchronously) where the API is
 * missing and under reduced motion, so callers never branch. A transition the
 * browser skips (a hidden tab, a newer transition) still applies the update and
 * rejects neither promise. Await the run for the new view; await `finished` to
 * undo styling that shapes the animation itself.
 */
export function startViewTransition(update: () => void | Promise<void>): ViewTransitionRun {
  const reduced = typeof window !== "undefined" && window.matchMedia?.(REDUCED_MOTION_QUERY).matches;
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function" || reduced) {
    const applied = (async () => {
      await update();
    })();
    return Object.assign(applied, { finished: applied.then(noop, noop) });
  }
  const transition = document.startViewTransition(update);
  // A skipped transition rejects `ready`; the update still runs.
  transition.ready.catch(noop);
  // The native `finished` rejects when the update does; the run already reports that.
  return Object.assign(transition.updateCallbackDone.then(noop), { finished: transition.finished.then(noop, noop) });
}

/**
 * `startViewTransition` for React state: the update is flushed synchronously
 * (`flushSync`), so the browser's "after" snapshot sees the new render.
 *
 * @example
 * const transition = useViewTransition();
 * <Button onClick={() => transition(() => setLayout("grid"))}>Grid</Button>
 */
export function useViewTransition(): (update: () => void) => ViewTransitionRun {
  return useCallback((update: () => void) => startViewTransition(() => flushSync(update)), []);
}
