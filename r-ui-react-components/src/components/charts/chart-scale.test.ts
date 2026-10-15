import { describe, expect, it } from "vitest";

import {
  estimateMeasure,
  fitLabels,
  isOnBoundary,
  linearScale,
  niceTicks,
  thinLabels,
  timeAxis,
  timeTickLabel,
  timeTicksAt,
} from "./chart-scale";

const measure = estimateMeasure(10); // 6.2px a character

describe("niceTicks", () => {
  it("rounds a domain out to numbers a reader can name", () => {
    expect(niceTicks(2, 37, 5)).toEqual({ lo: 0, hi: 40, ticks: [0, 10, 20, 30, 40] });
    expect(niceTicks(0, 2410, 6)).toEqual({ lo: 0, hi: 2500, ticks: [0, 500, 1000, 1500, 2000, 2500] });
  });

  it("never labels a gridline 0.30000000000000004", () => {
    const { ticks } = niceTicks(0, 1, 11);
    expect(ticks).toContain(0.3);
    for (const t of ticks) expect(String(t).length).toBeLessThanOrEqual(3);
  });

  it("keeps a pinned end exactly and brings the step down to fit inside it", () => {
    expect(niceTicks(0, 5, 6, true, true)).toEqual({ lo: 0, hi: 5, ticks: [0, 1, 2, 3, 4, 5] });
    expect(niceTicks(0, 5, 6).hi).toBe(5);
    expect(niceTicks(0, 5.5, 6).hi).toBe(6);
  });

  it("drops a multiple that crowds a pinned end, at either end", () => {
    expect(niceTicks(0, 1024, 5, false, true)).toEqual({ lo: 0, hi: 1024, ticks: [0, 200, 400, 600, 800, 1024] });
    expect(niceTicks(-24, 1000, 5, true, false).ticks).toEqual([-24, 200, 400, 600, 800, 1000]);
    // A multiple a full step away stays.
    expect(niceTicks(0, 9.9, 5, false, true).ticks).toEqual([0, 2, 4, 6, 8, 9.9]);
  });

  it("keeps one tick for a zero span rather than inventing a range", () => {
    expect(niceTicks(3, 3)).toEqual({ lo: 3, hi: 3, ticks: [3] });
  });

  it("spans negatives through zero", () => {
    expect(niceTicks(-12, 30, 6).ticks).toEqual([-20, -10, 0, 10, 20, 30]);
  });

  it("survives reversed, infinite, huge and denormal domains without NaN", () => {
    expect(niceTicks(9, 1, 5).lo).toBe(0);
    expect(niceTicks(Number.NaN, 5)).toEqual({ lo: 0, hi: 1, ticks: [0, 1] });
    expect(niceTicks(-Infinity, Infinity)).toEqual({ lo: 0, hi: 1, ticks: [0, 1] });
    for (const [lo, hi] of [
      [0, 1e308],
      [-1e308, 1e308],
      [-Number.MAX_VALUE, Number.MAX_VALUE],
      [0, 5e-324],
    ] as const) {
      const scale = niceTicks(lo, hi, 5);
      expect(scale.ticks.length).toBeGreaterThan(0);
      for (const t of [scale.lo, scale.hi, ...scale.ticks]) expect(Number.isFinite(t)).toBe(true);
    }
  });

  it("never returns more ticks than asked for, plus the two pinned ends", () => {
    for (let count = 2; count <= 12; count += 1) {
      expect(niceTicks(0, 97, count).ticks.length).toBeLessThanOrEqual(count + 1);
    }
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range and clamps outside it", () => {
    const y = linearScale(0, 100, 200, 0);
    expect([y(0), y(50), y(100), y(150), y(-5)]).toEqual([200, 100, 0, 0, 200]);
  });

  it("gives no position to what is not a number", () => {
    const y = linearScale(0, 1, 0, 100);
    expect([y(null), y(undefined), y(Number.NaN), y(Infinity)]).toEqual([null, null, null, null]);
  });

  it("halves a span too wide for a double instead of dividing by Infinity", () => {
    const y = linearScale(-1e308, 1e308, 0, 100);
    expect(y(0)).toBe(50);
    expect(y(1e308)).toBe(100);
  });

  it("puts every value of a zero span in the middle", () => {
    expect(linearScale(4, 4, 0, 100)(4)).toBe(50);
  });
});

describe("label fitting", () => {
  it("pulls end labels inside the bounds and refuses an overlap", () => {
    const placed = fitLabels([{ at: 0, text: "Mon" }, { at: 100, text: "Tue" }], measure, 0, 100, 4);
    expect(placed?.map((l) => [l.center, l.width])).toEqual([
      [9.3, 18.6],
      [90.7, 18.6],
    ]);
    expect(fitLabels([{ at: 10, text: "Monday" }, { at: 20, text: "Tuesday" }], measure, 0, 100, 4)).toBeNull();
  });

  it("thins to every k-th label, anchored at the most recent one", () => {
    const ticks = Array.from({ length: 24 }, (_, i) => ({ at: i * 10, text: `${String(i).padStart(2, "0")}:00` }));
    const placed = thinLabels(ticks, measure, 0, 240, 6);
    // "00:00" is 31px wide. Every 4th (40px apart) would fit, but the last label is
    // pulled 5.5px inside the edge, which closes its gap; every 5th fits, and every
    // 6th divides 24, so the hours keep a rhythm.
    expect(placed.map((l) => l.text)).toEqual(["05:00", "11:00", "17:00", "23:00"]);
    expect(thinLabels(ticks, measure, 0, 240, 6, "first").map((l) => l.text)).toEqual(["00:00", "06:00", "12:00", "18:00"]);
  });

  it("keeps one label when nothing else fits, and none when there is none", () => {
    expect(thinLabels([{ at: 5, text: "x".repeat(200) }], measure, 0, 50, 4)).toHaveLength(1);
    expect(thinLabels([], measure, 0, 50, 4)).toEqual([]);
  });
});

describe("time ticks", () => {
  const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo, d, h, mi);

  it("lands on calendar boundaries in the chosen zone", () => {
    const ticks = timeTicksAt(utc(2026, 9, 14, 1, 30), utc(2026, 9, 15, 0), { unit: "hour", step: 6 }, "UTC");
    expect(ticks.map((t) => new Date(t).toISOString())).toEqual([
      "2026-10-14T06:00:00.000Z",
      "2026-10-14T12:00:00.000Z",
      "2026-10-14T18:00:00.000Z",
      "2026-10-15T00:00:00.000Z",
    ]);
    expect(isOnBoundary(utc(2026, 9, 12), { unit: "week", step: 1 }, "UTC")).toBe(true); // a Monday
    expect(isOnBoundary(utc(2026, 9, 13), { unit: "week", step: 1 }, "UTC")).toBe(false);
  });

  it("restarts a two-day step on the 1st and steps months by the calendar", () => {
    const days = timeTicksAt(utc(2026, 0, 27), utc(2026, 1, 4), { unit: "day", step: 2 }, "UTC");
    expect(days.map((t) => new Date(t).getUTCDate())).toEqual([27, 29, 31, 1, 3]);
    const months = timeTicksAt(utc(2025, 10, 15), utc(2026, 3, 1), { unit: "month", step: 3 }, "UTC");
    expect(months.map((t) => new Date(t).toISOString().slice(0, 7))).toEqual(["2026-01", "2026-04"]);
  });

  it("names the day at midnight and the year in January", () => {
    expect(timeTickLabel(utc(2026, 9, 14, 6), { unit: "hour", step: 6 }, "UTC", "en-GB")).toBe("6:00");
    expect(timeTickLabel(utc(2026, 9, 15), { unit: "hour", step: 6 }, "UTC", "en-GB")).toBe("15 Oct");
    expect(timeTickLabel(utc(2026, 3, 1), { unit: "month", step: 3 }, "UTC", "en-GB")).toBe("Apr");
    expect(timeTickLabel(utc(2027, 0, 1), { unit: "month", step: 3 }, "UTC", "en-GB")).toBe("2027");
  });

  it("reads a malformed locale as the runtime default rather than throwing", () => {
    const tick = utc(2027, 0, 1);
    expect(timeTickLabel(tick, { unit: "month", step: 3 }, "UTC", "not a locale!")).toBe(
      timeTickLabel(tick, { unit: "month", step: 3 }, "UTC"),
    );
  });

  it("chooses the finest rung whose labels fit the width", () => {
    const t0 = utc(2026, 9, 8);
    const t1 = utc(2026, 9, 15);
    const at = (w: number) => linearScale(t0, t1, 0, w);
    const wide = timeAxis(t0, t1, (t) => at(1200)(t), measure, 0, 1200, 10, "UTC", "en-GB");
    const narrow = timeAxis(t0, t1, (t) => at(300)(t), measure, 0, 300, 10, "UTC", "en-GB");
    expect(wide.interval).toEqual({ unit: "hour", step: 12 });
    expect(narrow.interval).toEqual({ unit: "day", step: 2 });
    for (const axis of [wide, narrow]) {
      expect(axis.labels.length).toBeGreaterThanOrEqual(3);
      const gaps = axis.labels.slice(1).map((l, i) => {
        const prev = axis.labels[i] as (typeof axis.labels)[number];
        return l.center - l.width / 2 - (prev.center + prev.width / 2);
      });
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(10);
    }
  });

  it("climbs to multi-year steps for a span of centuries, and gives up on non-numbers", () => {
    const t0 = utc(1700, 0, 1);
    const t1 = utc(2026, 0, 1);
    const axis = timeAxis(t0, t1, (t) => linearScale(t0, t1, 0, 600)(t), measure, 0, 600, 10, "UTC", "en-GB");
    expect(axis.interval?.unit).toBe("year");
    expect(axis.interval?.step).toBeGreaterThanOrEqual(50);
    expect(timeAxis(Number.NaN, 1, () => 0, measure, 0, 600, 10, "UTC").labels).toEqual([]);
  });
});
