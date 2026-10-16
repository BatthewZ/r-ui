import { describe, expect, it } from "vitest";

import { dragTarget, fitSizes, keyTarget, normalizeSizes, type PaneBounds, pairRange, placePrimary, primaryPane } from "./splitter-model";

const open = (min = 0, max = 100): PaneBounds => ({ min, max, collapsible: false });
const folding = (min = 0, max = 100): PaneBounds => ({ min, max, collapsible: true });
const total = (sizes: number[]) => sizes.reduce((a, b) => a + b, 0);

describe("normalizeSizes", () => {
  it("scales to 100 and falls back to an equal split when the sizes cannot be used", () => {
    expect(normalizeSizes([1, 3], 2)).toEqual([25, 75]);
    expect(normalizeSizes([50, 50], 3)).toEqual([100 / 3, 100 / 3, 100 / 3]);
    expect(normalizeSizes(undefined, 4)).toEqual([25, 25, 25, 25]);
    expect(normalizeSizes([0, 0], 2)).toEqual([50, 50]);
    expect(normalizeSizes([-10, 110], 2)).toEqual([50, 50]);
  });
});

describe("fitSizes", () => {
  it("draws a pane below its minimum at the minimum, the room taken from panes that have it", () => {
    const fitted = fitSizes([10, 45, 45], [open(30), open(), open()]);
    expect(fitted[0]).toBe(30);
    expect(fitted[1]).toBeCloseTo(35);
    expect(fitted[2]).toBeCloseTo(35);
    expect(total(fitted)).toBeCloseTo(100);
  });

  it("gives what a capped pane frees to the others, never past their own caps", () => {
    const fitted = fitSizes([60, 20, 20], [open(0, 40), open(0, 25), open()]);
    expect(fitted[0]).toBe(40);
    expect(fitted[1]).toBeGreaterThan(20);
    expect(fitted[1]).toBeLessThanOrEqual(25);
    expect(total(fitted)).toBeCloseTo(100);
    // Nowhere for the rest to go: both stay at their caps.
    expect(fitSizes([60, 40], [open(0, 40), open(0, 50)])).toEqual([40, 50]);
  });

  it("keeps a collapsed pane at 0 while a non-collapsible one at 0 is drawn at its minimum", () => {
    expect(fitSizes([0, 100], [folding(20), open()])).toEqual([0, 100]);
    expect(fitSizes([0, 100], [open(20), open()])).toEqual([20, 80]);
  });

  it("leaves panes at their bounds when the bounds cannot all hold", () => {
    expect(fitSizes([50, 50], [open(70), open(60)])).toEqual([70, 60]);
  });
});

describe("pairRange and moves", () => {
  it("reports the pane before the separator unless only the one after it collapses", () => {
    expect(primaryPane([open(), open()], 0)).toBe(0);
    expect(primaryPane([folding(), folding()], 0)).toBe(0);
    expect(primaryPane([open(), folding()], 0)).toBe(1);
  });

  it("bounds the primary pane by both panes' bounds, keeping the pair's total", () => {
    const range = pairRange([20, 50, 30], [open(10, 60), open(15), open()], 1);
    expect(range).toMatchObject({ primary: 1, other: 2, total: 80, lo: 15, hi: 80 });
    const tight = pairRange([40, 60], [open(10, 45), open(30, 75)], 0);
    expect(tight).toMatchObject({ lo: 25, hi: 45 });
    expect(placePrimary([20, 50, 30], range, 62.346)).toEqual([20, 62.35, 17.65]);
  });

  it("steps by keys, stopping at each bound before passing it, and collapses only from the minimum", () => {
    const range = pairRange([30, 70], [folding(20, 60), open(30)], 0);
    expect(keyTarget(30, range, "grow", 5)).toBe(35);
    expect(keyTarget(58, range, "grow", 5)).toBe(60);
    expect(keyTarget(23, range, "shrink", 5)).toBe(20);
    expect(keyTarget(20, range, "shrink", 5)).toBe(0);
    expect(keyTarget(0, range, "grow", 5)).toBe(20);
    expect(keyTarget(45, range, "min", 5)).toBe(0);
    expect(keyTarget(45, range, "max", 5)).toBe(60);
    const fixed = pairRange([30, 70], [open(20, 60), open(30)], 0);
    expect(keyTarget(20, fixed, "shrink", 5)).toBe(20);
    expect(keyTarget(45, fixed, "min", 5)).toBe(20);
  });

  it("collapses a drag only past half the minimum, and clamps it otherwise", () => {
    const range = pairRange([30, 70], [folding(20, 60), open(30)], 0);
    expect(dragTarget(11, range)).toBe(20);
    expect(dragTarget(9, range)).toBe(0);
    expect(dragTarget(90, range)).toBe(60);
    const fixed = pairRange([30, 70], [open(20, 60), open(30)], 0);
    expect(dragTarget(2, fixed)).toBe(20);
  });
});
