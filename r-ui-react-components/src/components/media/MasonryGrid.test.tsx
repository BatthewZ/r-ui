import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MasonryGrid, placeMasonry } from "./MasonryGrid";

describe("placeMasonry", () => {
  it("puts each item in the shortest column so far, the inline-start one on a tie, a gap below the stack", () => {
    // Columns after each step: [100,0,0] [100,50,0] [100,50,80] → item 4 joins column 2 (50) …
    expect(placeMasonry([100, 50, 80, 40, 30, 60], 3, 10)).toEqual([
      { column: 0, top: 0 },
      { column: 1, top: 0 },
      { column: 2, top: 0 },
      { column: 1, top: 60 },
      { column: 2, top: 90 },
      { column: 0, top: 110 },
    ]);
  });

  it("one column stacks in order; zero or fractional counts fall back to whole columns", () => {
    expect(placeMasonry([20, 30, 40], 1, 5)).toEqual([
      { column: 0, top: 0 },
      { column: 0, top: 25 },
      { column: 0, top: 60 },
    ]);
    expect(placeMasonry([20, 30], 0, 5).map((p) => p.column)).toEqual([0, 0]);
    expect(placeMasonry([20, 30, 40], 2.7, 0).map((p) => p.column)).toEqual([0, 1, 0]);
  });

  it("every item starts no higher than the one before it (reading top-down meets them in source order)", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 300 + 20;
    const heights = Array.from({ length: 60 }, random);
    const tops = placeMasonry(heights, 4, 12).map((p) => p.top);
    expect(new Set(placeMasonry(heights, 4, 12).map((p) => p.column)).size).toBe(4);
    tops.forEach((top, i) => {
      if (i > 0) expect(top).toBeGreaterThanOrEqual(tops[i - 1]!);
    });
  });
});

describe("MasonryGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** jsdom has no layout: give the grid three 100px tracks and a 10px gap, and each item a height. */
  function stubLayout(heights: Record<string, number>) {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const style = real(el, pseudo);
      if (!(el as HTMLElement).classList.contains("r-media-masonry")) return style;
      const layout: Record<string, string> = { gridTemplateColumns: "100px 100px 100px", rowGap: "10px" };
      return new Proxy(style, {
        get: (target, key) => {
          if (typeof key === "string" && key in layout) return layout[key];
          const value = Reflect.get(target, key) as unknown;
          return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
        },
      });
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const height = heights[this.textContent ?? ""] ?? 0;
      return { x: 0, y: 0, top: 0, left: 0, right: 100, bottom: height, width: 100, height, toJSON: () => ({}) } as DOMRect;
    });
  }

  const card = (name: string) => screen.getByText(name).parentElement!;

  it("places each item in its column and offset, in source order, and marks the grid placed", () => {
    stubLayout({ A: 100, B: 50, C: 80, D: 40 });
    const { container } = render(
      <MasonryGrid>
        <p key="a">A</p>
        <p key="b">B</p>
        <p key="c">C</p>
        <p key="d">D</p>
      </MasonryGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveAttribute("data-placed");
    expect(grid).toHaveAttribute("data-columns", "3");
    const at = (name: string) => [
      card(name).style.getPropertyValue("--r-media-masonry-column"),
      card(name).style.getPropertyValue("--r-media-masonry-top"),
    ];
    expect(at("A")).toEqual(["1", "0"]);
    expect(at("B")).toEqual(["2", "0"]);
    expect(at("C")).toEqual(["3", "0"]);
    expect(at("D")).toEqual(["2", "60"]);
    // Source order is DOM order, so tab order follows it.
    expect([...grid.children].map((el) => el.textContent)).toEqual(["A", "B", "C", "D"]);
  });

  it("re-places on the next commit: an item added at the start moves the others, and keeps their nodes", () => {
    stubLayout({ A: 100, B: 50, C: 80, D: 40, Z: 30 });
    const items = (names: string[]) => names.map((n) => <p key={n}>{n}</p>);
    const { rerender } = render(<MasonryGrid>{items(["A", "B", "C", "D"])}</MasonryGrid>);
    const nodeOfA = card("A");
    rerender(<MasonryGrid>{items(["Z", "A", "B", "C", "D"])}</MasonryGrid>);
    expect(card("A")).toBe(nodeOfA);
    expect(card("Z").style.getPropertyValue("--r-media-masonry-column")).toBe("1");
    expect(card("A").style.getPropertyValue("--r-media-masonry-column")).toBe("2");
    // Z 30 · A 100 · B 50 in a row; C under Z (40), D under B (60).
    expect(card("C").style.getPropertyValue("--r-media-masonry-column")).toBe("1");
    expect(card("C").style.getPropertyValue("--r-media-masonry-top")).toBe("40");
    expect(card("D").style.getPropertyValue("--r-media-masonry-column")).toBe("3");
    expect(card("D").style.getPropertyValue("--r-media-masonry-top")).toBe("60");
  });

  it("with no layout to read (no tracks) the items stay a plain grid, unplaced", () => {
    const { container } = render(
      <MasonryGrid>
        <p>A</p>
        <p>B</p>
      </MasonryGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid).not.toHaveAttribute("data-placed");
    expect(card("A").style.getPropertyValue("--r-media-masonry-column")).toBe("");
  });

  it("list announces a list of items; gap, floor and the column cap reach the grid; the caller's class and style merge", () => {
    const { container } = render(
      <MasonryGrid list gap="r5" minColumn="sm" maxColumns={4} className="mt-r2" style={{ marginInline: "auto" }} classNames={{ item: "pb-r6" }}>
        <p>A</p>
        <p>B</p>
      </MasonryGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(screen.getByRole("list")).toBe(grid);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(grid).toHaveClass("r-media-masonry", "[--r-media-masonry-gap:var(--R-SIZE-5)]", "[--r-media-masonry-floor:var(--COLUMN-SM)]", "mt-r2");
    expect(grid.style.getPropertyValue("--r-media-masonry-max")).toBe("4");
    expect(grid.style.marginInline).toBe("auto");
    expect(card("A")).toHaveClass("r-media-masonry-item", "pb-r6");
  });

  it("defaults: no list role, the md floor and the r3 gap, no cap", () => {
    const { container } = render(
      <MasonryGrid>
        <p>A</p>
      </MasonryGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(screen.queryByRole("list")).toBeNull();
    expect(grid).toHaveClass("[--r-media-masonry-gap:var(--R-SIZE-3)]", "[--r-media-masonry-floor:var(--COLUMN-MD)]");
    expect(grid.style.getPropertyValue("--r-media-masonry-max")).toBe("");
    // Each item stays whole on paper.
    expect(card("A")).toHaveAttribute("data-print", "avoid-break");
  });
});
