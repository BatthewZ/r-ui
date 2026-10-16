import { describe, expect, it } from "vitest";

import { decimalsOf, keyTarget, moveThumb, normalizeThumbs, pickThumb, snapToStep, thumbBounds } from "./slider-core";

const scale = { min: 0, max: 100, step: 1, gap: 0 };
const keys = { ...scale, largeStep: 10, rtl: false, orientation: "horizontal" as const };

describe("snapToStep", () => {
  it("rounds onto min + k × step, clamped, ties up", () => {
    expect(snapToStep(42.4, scale)).toBe(42);
    expect(snapToStep(42.5, scale)).toBe(43);
    expect(snapToStep(-5, scale)).toBe(0);
    expect(snapToStep(250, scale)).toBe(100);
    // The grid starts at min, not at 0.
    expect(snapToStep(7, { min: 3, max: 30, step: 5 })).toBe(8);
  });

  it("never passes an off-grid max, and leaves no float noise", () => {
    expect(snapToStep(10, { min: 0, max: 10, step: 3 })).toBe(9);
    expect(snapToStep(0.3, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(snapToStep(0.7000001, { min: 0.1, max: 1, step: 0.2 })).toBe(0.7);
  });

  it("reads a missing value as min", () => {
    expect(snapToStep(Number.NaN, { min: 5, max: 9, step: 1 })).toBe(5);
  });

  it("counts fraction digits, exponents included", () => {
    expect(decimalsOf(0.05)).toBe(2);
    expect(decimalsOf(1e-7)).toBe(7);
    expect(decimalsOf(250)).toBe(0);
  });
});

describe("keyTarget", () => {
  it("steps, takes large steps, and goes to the ends", () => {
    expect(keyTarget("ArrowRight", false, 50, keys)).toBe(51);
    expect(keyTarget("ArrowUp", false, 50, keys)).toBe(51);
    expect(keyTarget("ArrowLeft", false, 50, keys)).toBe(49);
    expect(keyTarget("ArrowDown", true, 50, keys)).toBe(40);
    expect(keyTarget("PageUp", false, 50, keys)).toBe(60);
    expect(keyTarget("PageDown", false, 50, keys)).toBe(40);
    expect(keyTarget("Home", false, 50, keys)).toBe(0);
    expect(keyTarget("End", false, 50, keys)).toBe(100);
    expect(keyTarget("Tab", false, 50, keys)).toBeNull();
  });

  it("mirrors left and right on a horizontal RTL slider only", () => {
    expect(keyTarget("ArrowLeft", false, 50, { ...keys, rtl: true })).toBe(51);
    expect(keyTarget("ArrowRight", false, 50, { ...keys, rtl: true })).toBe(49);
    expect(keyTarget("ArrowUp", false, 50, { ...keys, rtl: true })).toBe(51);
    expect(keyTarget("ArrowRight", false, 50, { ...keys, rtl: true, orientation: "vertical" })).toBe(51);
  });
});

describe("thumbs", () => {
  const gapped = { ...scale, step: 5, gap: 10 };

  it("normalises a caller's pair: snapped, ordered, at least the gap apart, inside the scale", () => {
    expect(normalizeThumbs([70, 20], scale)).toEqual([20, 70]);
    expect(normalizeThumbs([40, 42], gapped)).toEqual([40, 50]);
    expect(normalizeThumbs([98, 100], gapped)).toEqual([90, 100]);
  });

  it("stops a thumb at its neighbour (plus the gap): thumbs never cross", () => {
    expect(moveThumb([20, 60], 0, 90, gapped)).toEqual([50, 60]);
    expect(moveThumb([20, 60], 1, 0, gapped)).toEqual([20, 30]);
    expect(thumbBounds([20, 60], 0, gapped)).toEqual([0, 50]);
    expect(thumbBounds([20, 60], 1, gapped)).toEqual([30, 100]);
  });

  it("returns the same array when nothing moves", () => {
    const values = [20, 30];
    expect(moveThumb(values, 0, 95, gapped)).toBe(values);
  });

  it("grabs the nearest thumb; coincident thumbs by side, a press on them (within the slop) the pair", () => {
    expect(pickThumb([20, 60], 35)).toBe(0);
    expect(pickThumb([20, 60], 45)).toBe(1);
    expect(pickThumb([40, 40], 50)).toBe(1);
    expect(pickThumb([40, 40], 30)).toBe(0);
    expect(pickThumb([40, 40], 40)).toEqual([0, 1]);
    expect(pickThumb([40, 40], 41.5, 2)).toEqual([0, 1]);
    expect(pickThumb([40, 40], 42.5, 2)).toBe(1);
    // A slop never makes a lone thumb a pair.
    expect(pickThumb([20, 60], 21, 5)).toBe(0);
    expect(pickThumb([30], 90)).toBe(0);
  });
});
