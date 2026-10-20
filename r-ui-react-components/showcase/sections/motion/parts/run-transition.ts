import { flushSync } from "react-dom";

import { startViewTransition } from "../../../../src/components/motion";

let latest = 0;

/**
 * A view transition that names its kind on `<html data-sc-vt="<kind>">`, with any
 * `vars` set on `<html>`, until it FINISHES, so the showcase's styles can give each
 * demo its own choreography (a direction, a reveal from a point) and its own
 * `view-transition-name`s. The marker goes on before the old view is captured. When
 * the library skips the transition (no API, reduced motion) the update applies at
 * once and `finished` settles right after it, so the marker never reaches a frame.
 */
export function runTransition(kind: string, update: () => void, vars: Record<string, string> = {}): void {
  const root = document.documentElement;
  const id = ++latest;
  root.dataset.scVt = kind;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  void startViewTransition(() => flushSync(update)).finished.then(() => {
    // A newer transition owns the marker now; it cleans up after itself.
    if (id !== latest) return;
    delete root.dataset.scVt;
    for (const name of Object.keys(vars)) root.style.removeProperty(name);
  });
}
