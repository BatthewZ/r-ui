import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useVirtualRows } from "./use-virtual-rows";

/** Build a real DOM element with a stubbed (jsdom has no layout) clientHeight. */
function makeScroller(clientHeight: number) {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useVirtualRows", () => {
  it("computes the initial window from the measured viewport", () => {
    const el = makeScroller(200);
    const ref = { current: el };

    const { result } = renderHook(() =>
      useVirtualRows({ rowCount: 1000, rowHeight: 50, overscan: 2, scrollRef: ref })
    );

    // viewport 200 / row 50 = 4 visible; + overscan*2 = 8 rows, scrollTop 0.
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(8);
    expect(result.current.paddingTop).toBe(0);
    expect(result.current.paddingBottom).toBe((1000 - 8) * 50);
    expect(result.current.totalHeight).toBe(1000 * 50);
  });

  it("shifts the window and spacers when scrolled", () => {
    const el = makeScroller(200);
    const ref = { current: el };

    const { result } = renderHook(() =>
      useVirtualRows({ rowCount: 1000, rowHeight: 50, overscan: 2, scrollRef: ref })
    );

    act(() => {
      el.scrollTop = 500; // 10 rows down
      el.dispatchEvent(new Event("scroll"));
    });

    // start = floor(500/50) - 2 = 8; visible 4; end = 8 + 4 + 4 = 16.
    expect(result.current.startIndex).toBe(8);
    expect(result.current.endIndex).toBe(16);
    expect(result.current.paddingTop).toBe(8 * 50);
    expect(result.current.paddingBottom).toBe((1000 - 16) * 50);
  });

  it("clamps the window at the end of the list", () => {
    const el = makeScroller(200);
    const ref = { current: el };

    const { result } = renderHook(() =>
      useVirtualRows({ rowCount: 20, rowHeight: 50, overscan: 2, scrollRef: ref })
    );

    act(() => {
      el.scrollTop = 100000; // far past the end
      el.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.endIndex).toBe(20); // never exceeds rowCount
    expect(result.current.paddingBottom).toBe(0);
    // The start is clamped too: the last full window, not an empty one past the end.
    expect(result.current.startIndex).toBe(20 - 4 - 2);
    expect(result.current.paddingTop).toBe(14 * 50);
  });

  it("clamps the window when the row height shrinks under a scrolled-down list", () => {
    const el = makeScroller(400);
    const ref = { current: el };

    const { result, rerender } = renderHook(({ rowHeight }) => useVirtualRows({ rowCount: 100, rowHeight, overscan: 2, scrollRef: ref }), {
      initialProps: { rowHeight: 44 },
    });

    act(() => {
      el.scrollTop = 100 * 44 - 400; // the very bottom at 44px rows
      el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.endIndex).toBe(100);

    // Compact density: rows drop to 30px before the browser re-clamps scrollTop.
    rerender({ rowHeight: 30 });

    const { startIndex, endIndex, paddingTop, paddingBottom, totalHeight } = result.current;
    expect(totalHeight).toBe(3000);
    // 400 / 30 = 14 visible (ceil); last window starts at 100 - 14 - 2.
    expect(startIndex).toBe(84);
    expect(endIndex).toBe(100);
    expect(startIndex).toBeLessThan(endIndex);
    // The spacers plus the window add up to the new list, never the old one.
    expect(paddingTop + (endIndex - startIndex) * 30 + paddingBottom).toBe(totalHeight);
  });

  it("falls back to initialViewport when there is no scroll element", () => {
    const ref = { current: null };

    const { result } = renderHook(() =>
      useVirtualRows({
        rowCount: 1000,
        rowHeight: 50,
        overscan: 0,
        scrollRef: ref,
        initialViewport: 250,
      })
    );

    // 250 / 50 = 5 visible rows, no overscan.
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(5);
  });

  it("guards against a non-positive row height", () => {
    const el = makeScroller(200);
    const ref = { current: el };

    const { result } = renderHook(() =>
      useVirtualRows({ rowCount: 10, rowHeight: 0, scrollRef: ref })
    );

    expect(Number.isFinite(result.current.endIndex)).toBe(true);
    expect(result.current.endIndex).toBeLessThanOrEqual(10);
  });
});
