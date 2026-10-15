"use client";
import { type RefObject, useEffect, useState } from "react";

export interface UseVirtualRowsParams {
  /** Total number of rows in the dataset. */
  rowCount: number;
  /** Fixed height of every row, in pixels. Must be > 0. */
  rowHeight: number;
  /** Extra rows rendered above and below the visible window. Defaults to 8. */
  overscan?: number;
  /** Ref to the scroll container element. */
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Initial viewport height (px) used to seed the window before the scroll
   * element is measured. Prevents an empty first paint (and matters for SSR /
   * RSC hydration). Pass the component's configured viewport height.
   */
  initialViewport?: number;
}

export interface UseVirtualRowsReturn {
  /** First row index to render (inclusive). */
  startIndex: number;
  /** Last row index to render (exclusive). */
  endIndex: number;
  /** Height (px) of the top spacer that offsets the rendered window. */
  paddingTop: number;
  /** Height (px) of the bottom spacer that preserves total scroll height. */
  paddingBottom: number;
  /** Total height (px) of the full (un-windowed) list. */
  totalHeight: number;
}

/**
 * Fixed-height row virtualization. Tracks the scroll container's scroll offset
 * and viewport height, then returns the slice of row indices that should be
 * mounted plus the top/bottom spacer heights needed to keep the scrollbar
 * proportional.
 *
 * Table-agnostic: pair it with spacer rows in a `<tbody>`, or absolute
 * positioning in a list — the consumer owns rendering.
 */
export function useVirtualRows({
  rowCount,
  rowHeight,
  overscan = 8,
  scrollRef,
  initialViewport = 0,
}: UseVirtualRowsParams): UseVirtualRowsReturn {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(initialViewport);

  // The element the listeners are currently attached to, surfaced as state so
  // the setup effect re-runs when the scroll container (re)mounts — e.g. when
  // the table leaves its loading/empty branch and swaps in a fresh element
  // after the initial (null) mount. This reconciliation effect has no dep array
  // so it runs after every commit, by which point `scrollRef.current` is set.
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (scrollRef.current !== scrollEl) {
      setScrollEl(scrollRef.current);
    }
  });

  useEffect(() => {
    const el = scrollEl;
    if (!el) return;

    const sync = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
    };

    // Measure once on mount so the seeded estimate is corrected to reality.
    sync();

    el.addEventListener("scroll", sync, { passive: true });

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(sync);
      observer.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [scrollEl]);

  const safeRowHeight = rowHeight > 0 ? rowHeight : 1;
  const safeRowCount = Math.max(0, rowCount);
  const totalHeight = safeRowCount * safeRowHeight;

  const visibleCount = Math.ceil(viewportHeight / safeRowHeight);
  // Clamped to the last full window. A scroll offset can outrun the list for a
  // render: the row height shrinks (density, input) while scrolled down, or the
  // row count drops. Unclamped, the top spacer alone would exceed the new total
  // height and keep the stale scroll height alive.
  const lastStart = Math.max(0, safeRowCount - visibleCount - overscan);
  const startIndex = Math.min(Math.max(0, Math.floor(scrollTop / safeRowHeight) - overscan), lastStart);
  const endIndex = Math.min(safeRowCount, startIndex + visibleCount + overscan * 2);

  const paddingTop = startIndex * safeRowHeight;
  const paddingBottom = Math.max(0, (safeRowCount - endIndex) * safeRowHeight);

  return { startIndex, endIndex, paddingTop, paddingBottom, totalHeight };
}
