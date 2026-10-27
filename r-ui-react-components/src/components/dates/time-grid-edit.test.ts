// West of Greenwich, with a DST change (1 November 2026), before any local Date is built.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";

import { toISODate } from "./date-core";
import { type CalendarEvent, placeEvents } from "./event-core";
import { type CalendarRange, rangeOf } from "./event-edit";
import { type GrabKey, keepsKind, keyedTarget, placedAt, pressOffset, startUnder, stepToSlot } from "./time-grid-edit";

const d = (day: number, h = 0, min = 0, month = 10) => new Date(2026, month - 1, day, h, min);
const one = (event: Partial<CalendarEvent>) => placeEvents([{ id: "e", title: "E", start: d(15, 13), end: d(15, 14), ...event }])[0]!;
/** A range as local wall-clock text, so the assertions read like a calendar. */
const show = (r: CalendarRange | null) => {
  if (!r) return null;
  const t = (x: Date) => `${toISODate(x)} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  return r.allDay ? `${toISODate(r.start)}..${toISODate(r.end)} all-day` : `${t(r.start)} → ${t(r.end)}`;
};
const key = (k: string, shift = false, rtl = false): GrabKey => ({ key: k, shift, rtl });
/** Keys pressed one after another from where `p` is. */
const walk = (p: ReturnType<typeof one>, keys: GrabKey[], slot: 15 | 30 | 60 = 30) =>
  keys.reduce<CalendarRange | null>((at, k) => (at ? (keyedTarget(p, at, k, slot) ?? at) : at), rangeOf(p));

describe("time grid edit targets", () => {
  it("steps to the next slot boundary, a whole slot from one, the nearest from between two", () => {
    expect(stepToSlot(780, 1, 30)).toBe(810);
    expect(stepToSlot(780, -1, 30)).toBe(750);
    expect(stepToSlot(790, 1, 30)).toBe(810);
    expect(stepToSlot(790, -1, 30)).toBe(780);
    expect(stepToSlot(790, 1, 15)).toBe(795);
  });

  it("places an event at a range by placeEvents' rules", () => {
    const p = one({});
    const moved = placedAt(p, { start: d(16, 23), end: d(17, 0), allDay: false });
    expect([toISODate(moved.firstDay), toISODate(moved.lastDay)]).toEqual(["2026-10-16", "2026-10-16"]);
    const bar = placedAt(one({ start: "2026-10-15", end: "2026-10-16" }), { start: d(16), end: d(18), allDay: true });
    expect([toISODate(bar.firstDay), toISODate(bar.lastDay), bar.end]).toEqual(["2026-10-16", "2026-10-18", d(19).getTime()]);
  });

  it("moves a block by slots and days with arrows, and its end with Shift", () => {
    const p = one({});
    expect(show(walk(p, [key("ArrowDown"), key("ArrowDown")]))).toBe("2026-10-15 14:00 → 2026-10-15 15:00");
    expect(show(walk(p, [key("ArrowUp")], 15))).toBe("2026-10-15 12:45 → 2026-10-15 13:45");
    expect(show(walk(p, [key("ArrowRight")]))).toBe("2026-10-16 13:00 → 2026-10-16 14:00");
    expect(show(walk(p, [key("ArrowLeft")]))).toBe("2026-10-14 13:00 → 2026-10-14 14:00");
    // Mirrored right to left.
    expect(show(walk(p, [key("ArrowLeft", false, true)]))).toBe("2026-10-16 13:00 → 2026-10-16 14:00");
    expect(show(walk(p, [key("ArrowDown", true)]))).toBe("2026-10-15 13:00 → 2026-10-15 14:30");
    // One slot is the shortest.
    expect(show(walk(p, [key("ArrowUp", true), key("ArrowUp", true), key("ArrowUp", true)]))).toBe("2026-10-15 13:00 → 2026-10-15 13:30");
    // Shift with Left / Right does nothing to a block; other keys are not the grab's.
    expect(keyedTarget(p, rangeOf(p), key("ArrowRight", true), 30)).toBeNull();
    expect(keyedTarget(p, rangeOf(p), key("Home"), 30)).toBeNull();
  });

  it("moves a block's start off a boundary onto the nearest one, and keeps it inside its day", () => {
    const p = one({ start: d(15, 13, 10), end: d(15, 13, 40) });
    expect(show(walk(p, [key("ArrowDown")]))).toBe("2026-10-15 13:30 → 2026-10-15 14:00");
    expect(show(walk(p, [key("ArrowUp")]))).toBe("2026-10-15 13:00 → 2026-10-15 13:30");
    const early = one({ start: d(15, 0), end: d(15, 1) });
    expect(keyedTarget(early, rangeOf(early), key("ArrowUp"), 30)).toBeNull();
    const late = one({ start: d(15, 23, 30), end: d(16, 0) });
    expect(keyedTarget(late, rangeOf(late), key("ArrowDown"), 30)).toBeNull();
  });

  it("moves a block's end past midnight, never to a day long", () => {
    const p = one({ start: d(15, 23), end: d(16, 0) });
    expect(show(walk(p, [key("ArrowDown", true)]))).toBe("2026-10-15 23:00 → 2026-10-16 00:30");
    const long = one({ start: d(15, 1), end: d(16, 0, 30) });
    expect(keyedTarget(long, rangeOf(long), key("ArrowDown", true), 30)).toBeNull();
  });

  it("moves all-day events by days, and their last day with Shift, never before the first", () => {
    const p = one({ start: "2026-10-15", end: "2026-10-16" });
    expect(show(walk(p, [key("ArrowRight")]))).toBe("2026-10-16..2026-10-17 all-day");
    expect(show(walk(p, [key("ArrowRight", true)]))).toBe("2026-10-15..2026-10-17 all-day");
    expect(show(walk(p, [key("ArrowLeft", true), key("ArrowLeft", true)]))).toBe("2026-10-15..2026-10-15 all-day");
    expect(keyedTarget(p, rangeOf(p), key("ArrowDown"), 30)).toBeNull();
  });

  it("moves a timed event a day or longer by days, keeping its time; nothing else", () => {
    const p = one({ start: d(12, 9), end: d(13, 12) });
    expect(show(walk(p, [key("ArrowRight")]))).toBe("2026-10-13 09:00 → 2026-10-14 12:00");
    expect(keyedTarget(p, rangeOf(p), key("ArrowRight", true), 30)).toBeNull();
    expect(keyedTarget(p, rangeOf(p), key("ArrowDown"), 30)).toBeNull();
  });

  it("keeps a block in the grid and a bar in the all-day row", () => {
    const p = one({});
    expect(keepsKind(p, { start: d(15, 13), end: d(16, 12), allDay: false })).toBe(true);
    expect(keepsKind(p, { start: d(15, 13), end: d(16, 13), allDay: false })).toBe(false);
    expect(keepsKind(one({ start: "2026-10-15" }), { start: d(16), end: d(16), allDay: true })).toBe(true);
  });

  it("holds a pressed block by its start, snapped down to slots, the start on an earlier day included", () => {
    const p = one({});
    expect(pressOffset(p, d(15), 13 * 60 + 40, 30)).toBe(30);
    expect(pressOffset(p, d(15), 13 * 60 + 20, 30)).toBe(0);
    expect(pressOffset(p, d(15), 13 * 60 + 40, 15)).toBe(30);
    // Began Friday 23:00, pressed on Saturday's part at 01:00: two hours below its start.
    const night = one({ start: d(16, 23), end: d(17, 2, 30) });
    expect(pressOffset(night, d(17), 60, 30)).toBe(120);
    expect(startUnder({ day: d(17), minute: 90 }, 120)).toEqual({ day: d(16), minute: 1410 });
    expect(startUnder({ day: d(17), minute: 180 }, 120)).toEqual({ day: d(17), minute: 60 });
  });

  it("steps over the change to winter time by the wall clock", () => {
    // Sunday 1 November 2026: 01:00–02:00 happens twice. A day later is still 13:00.
    const p = one({ start: d(31, 13), end: d(31, 14) });
    expect(show(walk(p, [key("ArrowRight")]))).toBe("2026-11-01 13:00 → 2026-11-01 14:00");
  });
});
