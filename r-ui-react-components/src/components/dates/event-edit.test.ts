// West of Greenwich, with a DST change, before any local Date is built.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";

import { toISODate } from "./date-core";
import {
  atMinute,
  type CalendarRange,
  dayRange,
  describeRange,
  isEditableEvent,
  moveByDays,
  moveToDay,
  moveToSlot,
  rangeOf,
  rangeTouchesDay,
  resizeToDay,
  resizeToSlot,
  sameRange,
  slotRange,
  snapToSlot,
} from "./event-edit";
import { type CalendarEvent, placeEvents } from "./event-core";
import { DEFAULT_EVENT_CALENDAR_LABELS } from "./event-parts";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
const one = (event: Partial<CalendarEvent>) => placeEvents([{ id: "e", title: "E", start: d(2026, 10, 15, 9), ...event }])[0]!;
/** A range as local wall-clock text, so the assertions read like a calendar. */
const show = (r: CalendarRange) => {
  const t = (x: Date) => `${toISODate(x)} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  return r.allDay ? `${toISODate(r.start)}..${toISODate(r.end)} all-day` : `${t(r.start)} → ${t(r.end)}`;
};

describe("slots", () => {
  it("snaps a minute to the start of its slot, kept inside the day", () => {
    expect(snapToSlot(574, 30)).toBe(570);
    expect(snapToSlot(570, 15)).toBe(570);
    expect(snapToSlot(-5, 30)).toBe(0);
    expect(snapToSlot(1439, 60)).toBe(1380);
    expect(snapToSlot(1440, 30)).toBe(1410);
  });

  it("builds a timed range over whole slots, either way round, across days", () => {
    const a = { day: d(2026, 10, 15), minute: 600 };
    const b = { day: d(2026, 10, 15), minute: 540 };
    expect(show(slotRange(a, b, 30))).toBe("2026-10-15 09:00 → 2026-10-15 10:30");
    expect(show(slotRange(a, a, 15))).toBe("2026-10-15 10:00 → 2026-10-15 10:15");
    expect(show(slotRange({ day: d(2026, 10, 16), minute: 60 }, { day: d(2026, 10, 15), minute: 1410 }, 30))).toBe(
      "2026-10-15 23:30 → 2026-10-16 01:30",
    );
    // The last slot of a day ends at the next midnight.
    expect(show(slotRange(a, { day: d(2026, 10, 15), minute: 1410 }, 30))).toBe("2026-10-15 10:00 → 2026-10-16 00:00");
  });

  it("reads wall-clock minutes on a DST day", () => {
    // 1 Nov 2026: 01:00–02:00 happens twice in New York; 09:30 is still 09:30.
    expect(atMinute(d(2026, 11, 1), 570).getHours()).toBe(9);
    expect(atMinute(d(2026, 11, 1), 570).getMinutes()).toBe(30);
  });

  it("builds an all-day range with an inclusive last day, either way round", () => {
    expect(show(dayRange(d(2026, 10, 17), d(2026, 10, 15, 13)))).toBe("2026-10-15..2026-10-17 all-day");
  });
});

describe("moving and resizing", () => {
  it("moves a timed event to a slot, keeping its length", () => {
    const p = one({ start: d(2026, 10, 15, 9), end: d(2026, 10, 15, 10, 30) });
    expect(show(moveToSlot(p, { day: d(2026, 10, 16), minute: 840 }))).toBe("2026-10-16 14:00 → 2026-10-16 15:30");
  });

  it("moves by days keeping a timed event's time of day across a DST change, and its real length", () => {
    const p = one({ start: d(2026, 10, 30, 9), end: d(2026, 10, 30, 10) });
    const moved = moveByDays(p, 3); // to Monday 2 November, after the clocks went back
    expect(show(moved)).toBe("2026-11-02 09:00 → 2026-11-02 10:00");
    expect(moved.end.getTime() - moved.start.getTime()).toBe(3_600_000);
  });

  it("moves an all-day event's days, its last day inclusive", () => {
    const p = one({ start: "2026-10-06", end: "2026-10-08" });
    expect(show(moveByDays(p, 7))).toBe("2026-10-13..2026-10-15 all-day");
    expect(show(moveToDay(p, d(2026, 10, 1)))).toBe("2026-10-01..2026-10-03 all-day");
  });

  it("resizes a timed end to the end of the slot under it, never shorter than one slot", () => {
    const p = one({ start: d(2026, 10, 15, 9), end: d(2026, 10, 15, 10) });
    expect(show(resizeToSlot(p, { day: d(2026, 10, 15), minute: 690 }, 30))).toBe("2026-10-15 09:00 → 2026-10-15 12:00");
    expect(show(resizeToSlot(p, { day: d(2026, 10, 15), minute: 420 }, 30))).toBe("2026-10-15 09:00 → 2026-10-15 09:30");
    expect(show(resizeToSlot(p, { day: d(2026, 10, 15), minute: 420 }, 15))).toBe("2026-10-15 09:00 → 2026-10-15 09:15");
  });

  it("resizes an all-day event's last day, never before its first", () => {
    const p = one({ start: "2026-10-06", end: "2026-10-08" });
    expect(show(resizeToDay(p, d(2026, 10, 10)))).toBe("2026-10-06..2026-10-10 all-day");
    expect(show(resizeToDay(p, d(2026, 10, 2)))).toBe("2026-10-06..2026-10-06 all-day");
  });

  it("says where an event is now, and compares ranges", () => {
    const p = one({ start: "2026-10-06", end: "2026-10-08" });
    expect(show(rangeOf(p))).toBe("2026-10-06..2026-10-08 all-day");
    expect(sameRange(rangeOf(p), moveByDays(p, 0))).toBe(true);
    expect(sameRange(rangeOf(p), moveByDays(p, 1))).toBe(false);
    expect(sameRange(null, null)).toBe(true);
    expect(sameRange(rangeOf(p), null)).toBe(false);
  });

  it("is editable only with onEventChange, unless the event opts out", () => {
    expect(isEditableEvent(one({}), undefined)).toBe(false);
    expect(isEditableEvent(one({}), () => {})).toBe(true);
    expect(isEditableEvent(one({ editable: false }), () => {})).toBe(false);
  });
});

describe("reading a range", () => {
  const L = DEFAULT_EVENT_CALENDAR_LABELS;
  it("says a day, a span of days, a time range and a range over midnight", () => {
    expect(describeRange(dayRange(d(2026, 10, 15), d(2026, 10, 15)), "en-US", L)).toBe("Thursday, October 15, All day");
    expect(describeRange(dayRange(d(2026, 10, 15), d(2026, 10, 17)), "en-US", L)).toMatch(/^Oct 15\s–\s17$/);
    const timed = slotRange({ day: d(2026, 10, 15), minute: 630 }, { day: d(2026, 10, 15), minute: 630 }, 30);
    expect(describeRange(timed, "en-US", L)).toMatch(/^Thursday, October 15, 10:30\s–\s11:00\sAM$/);
    const night = slotRange({ day: d(2026, 10, 15), minute: 1380 }, { day: d(2026, 10, 16), minute: 30 }, 30);
    expect(describeRange(night, "en-US", L)).toMatch(/^Oct 15, 11:00\sPM\s–\sOct 16, 1:00\sAM$/);
  });

  it("knows which days a range touches, an exclusive end at midnight not reaching the next", () => {
    const toMidnight = slotRange({ day: d(2026, 10, 15), minute: 1410 }, { day: d(2026, 10, 15), minute: 1410 }, 30);
    expect(rangeTouchesDay(toMidnight, d(2026, 10, 15))).toBe(true);
    expect(rangeTouchesDay(toMidnight, d(2026, 10, 16))).toBe(false);
    expect(rangeTouchesDay(dayRange(d(2026, 10, 15), d(2026, 10, 17)), d(2026, 10, 17))).toBe(true);
  });
});
