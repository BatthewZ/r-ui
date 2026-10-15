import { type CSSProperties, type ReactNode, useLayoutEffect, useState } from "react";

/**
 * The window the Dashboard's AppShell owns.
 *
 * AppShell is a page frame: it picks sidebar / rail / bottom nav from the
 * VIEWPORT and fills `--r-navigation-shell-viewport` (default 100dvh). Nested
 * inside the showcase's own sidebar and padding, it would answer the viewport
 * while living in a fraction of it, and show two navigations at once. So the
 * Dashboard takes the whole window below the showcase's top bar (which keeps
 * the brand link home and the View panel): a fixed layer that is its own
 * scroller, with the shell's viewport hook set to that layer's height. The
 * showcase's nav and padding sit underneath, unused; the shell's sidebar links
 * back to the other showcase pages.
 */
export function DashboardFrame({ children }: { children: ReactNode }) {
  const top = useTopBarHeight();
  const style = {
    insetBlockStart: top,
    "--r-navigation-shell-viewport": `calc(100dvh - ${top}px)`,
  } as CSSProperties;
  return (
    <div data-dashboard-frame="" className="fixed inset-x-0 bottom-0 z-4 overflow-y-auto bg-canvas" style={style}>
      {children}
    </div>
  );
}

/** The showcase top bar's live height (it re-derives with density and input). */
function useTopBarHeight(): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>(".sc-topbar");
    if (!bar) return;
    const measure = () => setHeight(bar.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  return height;
}
