import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReadingProgress, readingShare } from "./ReadingProgress";

const PORT = { top: 0, bottom: 800 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("readingShare", () => {
  it("is 0 until the region's top reaches the scrollport's top, and 1 once its bottom reaches the bottom", () => {
    // A 2000px article: its contain range is 1200px of scrolling.
    expect(readingShare({ top: 300, bottom: 2300 }, PORT)).toBe(0);
    expect(readingShare({ top: 0, bottom: 2000 }, PORT)).toBe(0);
    expect(readingShare({ top: -300, bottom: 1700 }, PORT)).toBe(0.25);
    expect(readingShare({ top: -1200, bottom: 800 }, PORT)).toBe(1);
    expect(readingShare({ top: -1900, bottom: 100 }, PORT)).toBe(1);
  });

  it("runs between the two edges the other way round for a region shorter than the scrollport", () => {
    // 400px tall: 0 with its bottom on the bottom edge, 1 with its top on the top edge.
    expect(readingShare({ top: 400, bottom: 800 }, PORT)).toBe(0);
    expect(readingShare({ top: 200, bottom: 600 }, PORT)).toBe(0.5);
    expect(readingShare({ top: 0, bottom: 400 }, PORT)).toBe(1);
  });

  it("measures against a scrollport that does not start at the viewport's top", () => {
    expect(readingShare({ top: 100, bottom: 1100 }, { top: 200, bottom: 600 })).toBeCloseTo(100 / 600);
  });
});

describe("ReadingProgress", () => {
  it("wraps the region with a decorative bar first: hidden from assistive tech, not printed, filled with the accent", () => {
    render(
      <ReadingProgress as="article" aria-label="Release notes" data-testid="r" className="prose">
        <h2>What changed</h2>
      </ReadingProgress>,
    );
    const region = screen.getByRole("article", { name: "Release notes" });
    expect(region).toHaveClass("r-motion-reading", "prose");
    const bar = region.firstElementChild;
    expect(bar).toHaveClass("r-motion-reading-bar");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar).toHaveAttribute("data-print", "hide");
    expect(bar?.firstElementChild).toHaveClass("r-motion-reading-fill", "bg-accent");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("heading", { name: "What changed" })).toBeInTheDocument();
  });

  it("without scroll-driven animations, writes the share read so far once per frame from one passive listener", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const listen = vi.spyOn(window, "addEventListener");
    let rect = { top: 0, bottom: 2000 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ ...rect, left: 0, right: 600, width: 600, height: rect.bottom - rect.top, x: 0, y: rect.top, toJSON: () => ({}) }) as DOMRect,
    );
    vi.stubGlobal("innerHeight", 800);

    render(<ReadingProgress data-testid="r">Body</ReadingProgress>);
    const fill = screen.getByTestId("r").querySelector<HTMLElement>(".r-motion-reading-fill");
    expect(fill?.style.getPropertyValue("--r-motion-reading-progress")).toBe("0");
    const scrolls = listen.mock.calls.filter(([type]) => type === "scroll");
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]?.[2]).toEqual({ capture: true, passive: true });

    rect = { top: -600, bottom: 1400 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    // Two scrolls in one frame: one update.
    expect(frames).toHaveLength(1);
    act(() => frames.splice(0).forEach((cb) => cb(0)));
    expect(fill?.style.getPropertyValue("--r-motion-reading-progress")).toBe("0.5");
  });

  it("registers no scroll listener where the browser draws the bar from a view timeline", () => {
    vi.stubGlobal("CSS", { supports: (q: string) => q === "animation-timeline: view()" });
    const listen = vi.spyOn(window, "addEventListener");
    render(<ReadingProgress data-testid="r">Body</ReadingProgress>);
    expect(listen.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(0);
    const fill = screen.getByTestId("r").querySelector<HTMLElement>(".r-motion-reading-fill");
    expect(fill?.style.getPropertyValue("--r-motion-reading-progress")).toBe("");
  });

  it("removes its listener when it unmounts", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ReadingProgress>Body</ReadingProgress>);
    unmount();
    expect(remove.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(1);
  });

  it("styles the bar and fill slots", () => {
    render(
      <ReadingProgress data-testid="r" classNames={{ bar: "top-r3", fill: "bg-primary" }}>
        Body
      </ReadingProgress>,
    );
    const bar = screen.getByTestId("r").querySelector(".r-motion-reading-bar");
    expect(bar).toHaveClass("top-r3");
    expect(bar?.firstElementChild).toHaveClass("bg-primary");
  });
});
