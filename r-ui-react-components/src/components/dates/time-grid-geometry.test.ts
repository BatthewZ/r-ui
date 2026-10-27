import { describe, expect, it } from "vitest";

import { toISODate } from "./date-core";
import { dayAtX, minuteAtY, slotAt } from "./time-grid-geometry";

/** A body laid out by hand: days at the given [left, right], an hour 80px tall from y = 100. */
function body(days: [string, number, number][]) {
  const root = document.createElement("div");
  const rect = (left: number, right: number, top: number) =>
    ({ left, right, top, bottom: top + 1, width: right - left, height: 1, x: left, y: top, toJSON() {} }) as DOMRect;
  for (const [iso, left, right] of days) {
    const el = document.createElement("div");
    el.className = "r-dates-timegrid-day";
    el.dataset.day = iso;
    el.getBoundingClientRect = () => rect(left, right, 100);
    root.append(el);
  }
  for (const hour of [0, 1]) {
    const line = document.createElement("div");
    line.dataset.hour = String(hour);
    line.getBoundingClientRect = () => rect(0, 1000, 100 + hour * 80);
    root.append(line);
  }
  return root;
}

// Wednesday wider than its neighbours: three meetings overlap there.
const WEEK = body([
  ["2026-10-13", 60, 160],
  ["2026-10-14", 160, 400],
  ["2026-10-15", 400, 500],
]);

describe("time grid geometry", () => {
  it("finds the day by the columns as laid out, unequal widths included, nearest past the ends", () => {
    expect(toISODate(dayAtX(WEEK, 170)!)).toBe("2026-10-14");
    expect(toISODate(dayAtX(WEEK, 399)!)).toBe("2026-10-14");
    expect(toISODate(dayAtX(WEEK, 401)!)).toBe("2026-10-15");
    expect(toISODate(dayAtX(WEEK, 10)!)).toBe("2026-10-13");
    expect(toISODate(dayAtX(WEEK, 900)!)).toBe("2026-10-15");
    expect(dayAtX(document.createElement("div"), 10)).toBeNull();
  });

  it("reads minutes from the hour lines and snaps to the slot, inside the day", () => {
    expect(minuteAtY(WEEK, 100 + 80 * 9.5)).toBe(570);
    expect(slotAt(WEEK, 450, 100 + 80 * 9.6, 30)).toEqual({ day: new Date(2026, 9, 15), minute: 570 });
    expect(slotAt(WEEK, 450, 100 + 80 * 9.6, 15)?.minute).toBe(570);
    expect(slotAt(WEEK, 450, 50, 30)?.minute).toBe(0);
    expect(slotAt(WEEK, 450, 100 + 80 * 30, 60)?.minute).toBe(1380);
    expect(minuteAtY(document.createElement("div"), 10)).toBeNull();
  });
});
