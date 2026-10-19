import type { CSSProperties, ReactNode } from "react";

import { useShowcaseBar } from "../../shell/bars";

/**
 * The window the Dashboard's AppShell owns.
 *
 * AppShell is a page frame: it picks sidebar / rail / bottom nav from the
 * VIEWPORT and fills `--r-navigation-shell-viewport` (default 100dvh). Nested
 * inside the showcase's own sidebar and padding, it would answer the viewport
 * while living in a fraction of it, and show two navigations at once. So the
 * Dashboard takes the window between the showcase's top bar (the home link and
 * the View panel) and its bottom nav (phones only; elsewhere it is not shown and
 * measures 0): a fixed layer that is its own scroller, with the shell's viewport
 * hook set to that layer's height. The showcase's sidebar sits underneath; the
 * Dashboard's own sidebar links back to the other showcase pages, and on phones
 * the showcase's bottom nav stays in reach below the Dashboard's. On paper the
 * frame prints in the flow (`data-print="flow"`), or only one window of it would.
 */
export function DashboardFrame({ children }: { children: ReactNode }) {
  const top = useShowcaseBar("top");
  const bottom = useShowcaseBar("bottom");
  const style = {
    insetBlockStart: top,
    insetBlockEnd: bottom,
    "--r-navigation-shell-viewport": `calc(100dvh - ${top + bottom}px)`,
  } as CSSProperties;
  return (
    <div data-dashboard-frame="" data-print="flow" className="fixed inset-x-0 z-docked overflow-y-auto bg-canvas" style={style}>
      {children}
    </div>
  );
}
