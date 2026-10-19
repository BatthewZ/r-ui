import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { CountUp } from "./CountUp";

/** A controllable IntersectionObserver; `enter()` reports every target fully in view. */
function stubObserver() {
  const observers: Array<{ callback: IntersectionObserverCallback; targets: Element[] }> = [];
  class FakeObserver {
    record: (typeof observers)[number];
    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, targets: [] };
      observers.push(this.record);
    }
    observe(target: Element) {
      this.record.targets.push(target);
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return {
    observers,
    enter: () =>
      act(() => {
        for (const o of observers) {
          const entries = o.targets.map(
            (target) =>
              ({
                target,
                isIntersecting: true,
                intersectionRatio: 1,
                intersectionRect: { height: 40 },
                boundingClientRect: { top: 100 },
                rootBounds: { height: 800 },
              }) as unknown as IntersectionObserverEntry,
          );
          o.callback(entries, o as unknown as IntersectionObserver);
        }
      }),
  };
}

/** jsdom lays nothing out: place every element below a 768px-tall window. */
function placeBelowFold() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 2000, bottom: 2040, left: 0, right: 200, width: 200, height: 40, x: 0, y: 2000, toJSON: () => ({}),
  });
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

/** Frames run only when the test says so. */
function stubFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    run: () =>
      act(() => {
        for (const cb of queue.splice(0)) cb(0);
      }),
  };
}

/**
 * jsdom has no Web Animations: a clock whose eased progress and state the test
 * sets. `calls` records each `animate()` (keyframes, options).
 */
function stubClock() {
  const clock = { progress: 0 as number | null, playState: "running", cancelled: 0 };
  const calls: Array<[unknown, KeyframeAnimationOptions]> = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    writable: true,
    value(keyframes: unknown, options: KeyframeAnimationOptions) {
      calls.push([keyframes, options]);
      return {
        effect: { getComputedTiming: () => ({ progress: clock.progress }) },
        get playState() {
          return clock.playState;
        },
        cancel: () => {
          clock.cancelled += 1;
        },
      };
    },
  });
  return { clock, calls };
}

const TIMING = { transitionDuration: "1.04s", transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)" };

/** The visible (aria-hidden) number, and what assistive tech gets. */
const visible = (root: HTMLElement) => root.querySelector(".r-motion-count-up-value")?.textContent;
const spoken = (root: HTMLElement) => root.querySelector(".sr-only")?.textContent;
/** Every text node outside an `aria-hidden` subtree, joined: what the accessibility tree holds. */
function readable(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('[aria-hidden="true"]')) text += node.textContent;
  }
  return text;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe("CountUp", () => {
  it("renders the final value on the server, with nothing waiting on script", () => {
    const html = renderToString(<CountUp value={12345} locale="en-US" />);
    expect(html).toContain('data-count="static"');
    // Sizer, visible value and the spoken copy all carry the final number.
    expect(html.match(/12,345/g)).toHaveLength(3);
    expect(html).not.toMatch(/>0</);
  });

  it("waits below the fold at its start, counts in the locale when scrolled into view, and lands on the exact value", () => {
    const io = stubObserver();
    placeBelowFold();
    const frames = stubFrames();
    const { clock, calls } = stubClock();
    render(<CountUp data-testid="n" value={2000} locale="de-DE" style={TIMING} />);
    const root = screen.getByTestId("n");

    expect(root).toHaveAttribute("data-count", "waiting");
    expect(visible(root)).toBe("0");
    expect(spoken(root)).toBe("2.000");

    io.enter();
    expect(calls).toHaveLength(1);
    // The token's timing, read off the element, drives a keyframe-less clock.
    expect(calls[0]).toEqual([[], { duration: 1040, easing: "cubic-bezier(0.2, 0, 0, 1)" }]);
    expect(root).toHaveAttribute("data-count", "counting");

    clock.progress = 0.6;
    frames.run();
    expect(visible(root)).toBe("1.200");
    expect(spoken(root)).toBe("2.000");

    clock.progress = null;
    clock.playState = "finished";
    frames.run();
    expect(visible(root)).toBe("2.000");
    expect(root).toHaveAttribute("data-count", "static");
  });

  it("keeps the final value as the only number assistive tech reads, from the first render", () => {
    stubObserver();
    placeBelowFold();
    render(<CountUp data-testid="n" value={98.6} from={10} locale="en-US" />);
    const root = screen.getByTestId("n");
    // The moving digits and the sizer are hidden; the spoken copy is not.
    const hidden = [...root.querySelectorAll('[aria-hidden="true"]')];
    expect(hidden.map((el) => el.className)).toEqual(["r-motion-count-up-sizer", "r-motion-count-up-value"]);
    expect(visible(root)).toBe("10");
    expect(readable(root)).toBe("98.6");
  });

  it("steps frames as finely as the value is written, with the caller's format", () => {
    const io = stubObserver();
    placeBelowFold();
    const frames = stubFrames();
    const { clock } = stubClock();
    const format = vi.fn((n: number, locale: string | undefined) => `${locale}:${n}`);
    render(<CountUp data-testid="n" value={98.6} format={format} locale="fr-FR" style={TIMING} />);
    const root = screen.getByTestId("n");
    io.enter();
    clock.progress = 0.333;
    frames.run();
    // 98.6 × 0.333 = 32.83… rounds to the value's one decimal.
    expect(visible(root)).toBe("fr-FR:32.8");
    expect(spoken(root)).toBe("fr-FR:98.6");
  });

  it("formats with the LocaleProvider's locale and the caller's options", () => {
    stubObserver();
    placeBelowFold();
    render(
      <LocaleProvider locale="de-DE">
        <CountUp data-testid="n" value={0.256} formatOptions={{ style: "percent", maximumFractionDigits: 1 }} />
      </LocaleProvider>,
    );
    expect(spoken(screen.getByTestId("n"))).toBe("25,6 %");
  });

  it("shows the final value at once under reduced motion, and never starts a clock", () => {
    stubReducedMotion(true);
    const io = stubObserver();
    placeBelowFold();
    const { calls } = stubClock();
    render(<CountUp data-testid="n" value={2000} locale="en-US" style={TIMING} />);
    const root = screen.getByTestId("n");
    expect(root).toHaveAttribute("data-count", "static");
    expect(visible(root)).toBe("2,000");
    expect(io.observers).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("lands at once when the computed duration is zero (a theme or reduced motion collapsed it)", () => {
    const io = stubObserver();
    placeBelowFold();
    const { calls } = stubClock();
    render(<CountUp data-testid="n" value={2000} locale="en-US" style={{ transitionDuration: "0s" }} />);
    const root = screen.getByTestId("n");
    expect(visible(root)).toBe("0");
    io.enter();
    expect(calls).toHaveLength(0);
    expect(visible(root)).toBe("2,000");
    expect(root).toHaveAttribute("data-count", "static");
  });

  it("renders a missing value as the dash and never counts it", () => {
    const io = stubObserver();
    placeBelowFold();
    render(<CountUp data-testid="n" value={Number.NaN} />);
    const root = screen.getByTestId("n");
    expect(visible(root)).toBe("—");
    expect(spoken(root)).toBe("—");
    expect(root).toHaveAttribute("data-count", "static");
    expect(io.observers).toHaveLength(0);
  });

  it("stops its clock when it unmounts mid-count", () => {
    const io = stubObserver();
    placeBelowFold();
    stubFrames();
    const { clock } = stubClock();
    const { unmount } = render(<CountUp value={50} style={TIMING} />);
    io.enter();
    unmount();
    expect(clock.cancelled).toBe(1);
  });

  it("puts the caller's className and props on the root, with tabular figures", () => {
    render(<CountUp data-testid="n" value={7} className="text-h2" />);
    const root = screen.getByTestId("n");
    expect(root).toHaveClass("r-motion-count-up", "tabular-nums", "text-h2");
  });
});
