"use client";
import { type ElementType, useEffect, useRef } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

export type ReadingProgressProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  { classNames?: SlotClassNames<"bar" | "fill"> }
>;

/** True where the browser draws the bar from a view timeline, with no script. */
function scrollDriven(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: view()");
}

/** The visible box of the nearest ancestor that scrolls vertically, else the viewport. */
function scrollport(element: Element): { top: number; bottom: number } {
  for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      const top = node.getBoundingClientRect().top + node.clientTop;
      return { top, bottom: top + node.clientHeight };
    }
  }
  return { top: 0, bottom: window.innerHeight };
}

/**
 * The share of `element` read, as the CSS `contain` range measures it: 0 while
 * its top is below the scrollport's top, 1 once its bottom is above the
 * scrollport's bottom (for a region shorter than the scrollport the two meet
 * the other way round, and the share runs between them all the same).
 */
export function readingShare(rect: { top: number; bottom: number }, port: { top: number; bottom: number }): number {
  // Scroll distance until the top reaches the top, and until the bottom reaches the bottom.
  const toTop = rect.top - port.top;
  const toBottom = rect.bottom - port.bottom;
  const start = Math.min(toTop, toBottom);
  const end = Math.max(toTop, toBottom);
  if (end === start) return start <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -start / (end - start)));
}

/**
 * A thin bar along the top of the scrollport showing how far the reader is
 * through this region (an article, a long form): it wraps the region, sticks
 * to the top while the region is in view and leaves with it.
 *
 * Drawn by a scroll-driven animation on the region's view timeline where the
 * browser has one; elsewhere one passive scroll listener writes the share once
 * per frame. It is a position read straight off the scroll, with no easing, so
 * reduced motion keeps it.
 *
 * Decorative, and `aria-hidden`: the reader's position is already what a
 * screen reader's own cursor tracks, so a `progressbar` would repeat it as a
 * widget that only scrolling changes. Not printed. The bar takes no space and
 * no pointer; offset it under a sticky header with `classNames.bar` (`top-…`).
 * The region must not clip (`overflow: hidden` would end the stickiness), and
 * its scrollport is its nearest scroll container: inside a box that scrolls only
 * sideways the bar measures that box, not the page.
 */
export function ReadingProgress<C extends ElementType = "div">({
  as,
  className,
  classNames,
  children,
  ref,
  ...props
}: ReadingProgressProps<C>) {
  const Tag: ElementType = as ?? "div";
  const own = useRef<HTMLElement>(null);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const region = own.current;
    const drawn = fill.current;
    if (!region || !drawn || scrollDriven()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const share = readingShare(region.getBoundingClientRect(), scrollport(region));
      drawn.style.setProperty("--r-motion-reading-progress", String(share));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    // Capture: a scroll in any scroller (the region's may not be the window) reaches it.
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(region);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      resize?.disconnect();
    };
  }, []);

  return (
    <Tag {...props} ref={mergeRefs(ref, own)} className={cn("r-motion-reading", className)}>
      <div aria-hidden="true" data-print="hide" className={cn("r-motion-reading-bar", classNames?.bar)}>
        <div ref={fill} className={cn("r-motion-reading-fill bg-accent", classNames?.fill)} />
      </div>
      {children}
    </Tag>
  );
}
