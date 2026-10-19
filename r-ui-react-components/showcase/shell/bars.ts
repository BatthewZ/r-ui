import { useLayoutEffect, useState } from "react";

/** The showcase's own bars, which a page that sticks or fixes chrome of its own must clear. */
const BARS = { top: ".sc-topbar", bottom: "[data-showcase-bottomnav]" } as const;

/**
 * A showcase bar's live height: it re-derives with density and input, and is
 * 0 while the bar is hidden (the bottom nav off phones). A site's sticky
 * header would stick at 0; a page inside the showcase sticks under the top bar.
 */
export function useShowcaseBar(bar: keyof typeof BARS): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(BARS[bar]);
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bar]);
  return height;
}
