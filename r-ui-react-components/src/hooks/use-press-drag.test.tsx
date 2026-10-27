import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DRAG_THRESHOLD, edgeSpeed, LONG_PRESS_MS, LONG_PRESS_SLOP, type PressDrag, usePressDrag } from "./use-press-drag";

type Calls = {
  start: PressDrag<string>[];
  move: { x: number; y: number }[];
  end: [string, "drop" | "cancel"][];
};

function Harness({ calls, refuse = false, enabled = true, onClick }: { calls: Calls; refuse?: boolean; enabled?: boolean; onClick?: () => void }) {
  const drag = usePressDrag<string>({
    enabled,
    onStart: (d) => {
      calls.start.push({ ...d });
      return refuse ? false : undefined;
    },
    onMove: (d) => calls.move.push({ x: d.x, y: d.y }),
    onEnd: (d, how) => calls.end.push([d.payload, how]),
  });
  return (
    <div ref={drag.rootRef}>
      <button type="button" onPointerDown={(e) => drag.onPointerDown(e, "item")} onClick={onClick}>
        Item
        <input aria-label="inside" />
      </button>
    </div>
  );
}

const fresh = (): Calls => ({ start: [], move: [], end: [] });
const down = (el: Element, x = 10, y = 10, pointerType = "mouse") =>
  fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, pointerType });
const move = (x: number, y: number) => fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
const up = (x: number, y: number) => fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

afterEach(() => vi.useRealTimers());

describe("usePressDrag", () => {
  it("is a click until the pointer travels the threshold, then a drag that drops once", () => {
    const calls = fresh();
    const onClick = vi.fn();
    render(<Harness calls={calls} onClick={onClick} />);
    const item = screen.getByRole("button", { name: /item/i });

    down(item);
    move(10 + DRAG_THRESHOLD - 1, 10);
    expect(calls.start).toHaveLength(0);
    up(10 + DRAG_THRESHOLD - 1, 10);
    fireEvent.click(item);
    expect(calls.end).toEqual([]);
    expect(onClick).toHaveBeenCalledTimes(1);

    down(item);
    move(10 + DRAG_THRESHOLD + 2, 10);
    expect(calls.start).toHaveLength(1);
    expect(calls.start[0]).toMatchObject({ payload: "item", x0: 10, y0: 10, pointerType: "mouse" });
    move(40, 30);
    up(50, 30);
    expect(calls.end).toEqual([["item", "drop"]]);
    expect(calls.move.at(-1)).toEqual({ x: 50, y: 30 });
    // The release's click is swallowed: the dragged button does not also press.
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("cancels on Escape, and ignores the pointer after", () => {
    const calls = fresh();
    render(<Harness calls={calls} />);
    down(screen.getByRole("button", { name: /item/i }));
    move(30, 10);
    fireEvent.keyDown(window, { key: "Escape" });
    up(40, 10);
    expect(calls.end).toEqual([["item", "cancel"]]);
  });

  it("takes a resting touch after the long press, and treats a moving one as a scroll", () => {
    vi.useFakeTimers();
    const calls = fresh();
    render(<Harness calls={calls} />);
    const item = screen.getByRole("button", { name: /item/i });

    down(item, 10, 10, "touch");
    move(10 + LONG_PRESS_SLOP + 1, 10);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(calls.start).toHaveLength(0);
    up(30, 10);

    down(item, 10, 10, "touch");
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(calls.start).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(1));
    expect(calls.start).toHaveLength(1);
    // A picked-up touch's moves are not the page's scroll.
    const touchMove = new Event("touchmove", { cancelable: true, bubbles: true });
    item.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);
    up(30, 30);
    expect(calls.end).toEqual([["item", "drop"]]);
  });

  it("ends quietly when onStart refuses, and starts nothing when disabled or in a form control", () => {
    const calls = fresh();
    const { rerender } = render(<Harness calls={calls} refuse />);
    const item = screen.getByRole("button", { name: /item/i });
    down(item);
    move(40, 10);
    up(40, 10);
    expect(calls.start).toHaveLength(1);
    expect(calls.end).toEqual([]);

    rerender(<Harness calls={calls} enabled={false} />);
    down(item);
    move(40, 10);
    up(40, 10);
    expect(calls.start).toHaveLength(1);

    rerender(<Harness calls={calls} />);
    down(screen.getByRole("textbox", { name: "inside" }));
    move(40, 10);
    up(40, 10);
    expect(calls.start).toHaveLength(1);
  });
});

describe("usePressDrag's page", () => {
  /** A box that scrolls vertically, its geometry given (jsdom lays nothing out). */
  const scroller = (el: HTMLElement, top: number, bottom: number) => {
    el.style.overflowY = "auto";
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 5000 });
    Object.defineProperty(el, "clientHeight", { configurable: true, value: bottom - top });
    el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 1000, width: 1000, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect;
  };

  function Area() {
    const drag = usePressDrag<string>({ onStart: () => {}, onMove: () => {}, onEnd: () => {} });
    return (
      <div data-testid="page">
        <div ref={drag.rootRef}>
          <div data-testid="inner">
            <button type="button" onPointerDown={(e) => drag.onPointerDown(e, "item")}>
              Item
            </button>
          </div>
        </div>
      </div>
    );
  }

  it("is the scroller around the whole area, not one inside it holding the pressed element", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"] });
    render(<Area />);
    const page = screen.getByTestId("page");
    const inner = screen.getByTestId("inner");
    scroller(page, 0, 600);
    // The inner box ends where the page does, so the pointer is at both bottoms.
    scroller(inner, 300, 600);
    down(screen.getByRole("button", { name: "Item" }), 10, 400);
    move(10, 599);
    act(() => void vi.advanceTimersByTime(100));
    up(10, 599);
    expect(page.scrollTop).toBeGreaterThan(0);
    // Not listed in `scrollers`, the inner box is not the page: it stays put.
    expect(inner.scrollTop).toBe(0);
  });
});

describe("edgeSpeed", () => {
  it("is zero in the middle and rises toward each edge, within a third of the box", () => {
    expect(edgeSpeed(500, 0, 1000, 48, 16)).toBe(0);
    expect(edgeSpeed(0, 0, 1000, 48, 16)).toBe(-16);
    expect(edgeSpeed(1000, 0, 1000, 48, 16)).toBe(16);
    expect(edgeSpeed(24, 0, 1000, 48, 16)).toBe(-8);
    // Past the edge (the pointer outside the box) is full speed, not more.
    expect(edgeSpeed(1100, 0, 1000, 48, 16)).toBe(16);
    expect(edgeSpeed(-50, 0, 1000, 48, 16)).toBe(-16);
    // A 60px box: the band is 20px, not 48.
    expect(edgeSpeed(30, 0, 60, 48, 16)).toBe(0);
    expect(edgeSpeed(0, 0, 0, 48, 16)).toBe(0);
  });
});
