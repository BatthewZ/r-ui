import { flushSync } from "react-dom";

import { REDUCED_MOTION_QUERY } from "../../../../src/hooks/use-reduced-motion";

let latest = 0;

/**
 * A view transition that names its kind on `<html data-sc-vt="<kind>">`, with any
 * `vars` set on `<html>`, until it FINISHES, so the showcase's styles can give each
 * demo its own choreography (a direction, a reveal from a point) and its own
 * `view-transition-name`s. The library's `useViewTransition` settles once the update
 * has applied, which is too early for styles that shape the animation itself.
 * Skipped like the library's: without the API, or under reduced motion, the update
 * simply applies.
 */
export function runTransition(kind: string, update: () => void, vars: Record<string, string> = {}): void {
  const root = document.documentElement;
  if (typeof document.startViewTransition !== "function" || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    update();
    return;
  }
  const id = ++latest;
  root.dataset.scVt = kind;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  const transition = document.startViewTransition(() => flushSync(update));
  // A skipped transition (a newer one started, a hidden tab) rejects `ready`; the update still ran.
  transition.ready.catch(() => {});
  void transition.finished.finally(() => {
    // A newer transition owns the attribute now; it cleans up after itself.
    if (id !== latest) return;
    delete root.dataset.scVt;
    for (const name of Object.keys(vars)) root.style.removeProperty(name);
  });
}
