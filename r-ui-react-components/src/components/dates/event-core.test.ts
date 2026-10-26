// West of Greenwich, with a DST change, before any local Date is built: a
// `toISOString()` or UTC getter would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";

import { toISODate } from "./date-core";
import {
  type CalendarEvent,
  drawnEnd,
  layoutDay,
  layoutRow,
  MAX_EVENTS,
  minuteOfDay,
  monthWeeks,
  periodOf,
  placeEvents,
  stepDate,
} from "./event-core";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
const ev = (id: string, start: CalendarEvent["start"], end?: CalendarEvent["end"], extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: id,
  start,
  end,
  ...extra,
});
const days = (p: { firstDay: Date; lastDay: Date }) => `${toISODate(p.firstDay)}..${toISODate(p.lastDay)}`;

describe("placeEvents", () => {
  it("reads YYYY-MM-DD as an all-day calendar date with an inclusive last day", () => {
    const [p] = placeEvents([ev("m", "2026-10-06", "2026-10-08")]);
    expect(p?.allDay).toBe(true);
    expect(days(p!)).toBe("2026-10-06..2026-10-08");
    expect(p?.start).toBe(d(2026, 10, 6).getTime());
    expect(p?.end).toBe(d(2026, 10, 9).getTime());
  });

  it("ends an instant exclusively: an event ending at midnight stays on its day", () => {
    const [p] = placeEvents([ev("late", d(2026, 10, 15, 22), d(2026, 10, 16, 0))]);
    expect(days(p!)).toBe("2026-10-15..2026-10-15");
  });

  it("spans every day a cross-midnight event touches", () => {
    const [p] = placeEvents([ev("migration", "2026-10-15T23:00:00-04:00", "2026-10-16T02:30:00-04:00")]);
    expect(p?.allDay).toBe(false);
    expect(days(p!)).toBe("2026-10-15..2026-10-16");
  });

  it("takes allDay on an instant as that instant's local day", () => {
    const [p] = placeEvents([ev("a", d(2026, 10, 15, 18), d(2026, 10, 17, 9), { allDay: true })]);
    expect(days(p!)).toBe("2026-10-15..2026-10-17");
  });

  it("leaves out events whose start is not a time, keeps the rest", () => {
    const placed = placeEvents([
      ev("bad", "not a date"),
      ev("empty", ""),
      ev("nan", Number.NaN),
      ev("huge", 9e15),
      ev("feb30", "2026-02-30"),
      ev("ok", d(2026, 10, 1, 9)),
    ]);
    expect(placed.map((p) => p.key)).toEqual(["ok"]);
  });

  it("makes an end before the start (or missing) a moment, or one day all-day", () => {
    const [moment, oneDay] = placeEvents([
      ev("moment", d(2026, 10, 1, 9), d(2026, 10, 1, 8)),
      ev("day", "2026-10-05", "2026-10-02"),
    ]);
    expect(moment?.end).toBe(moment?.start);
    expect(days(moment!)).toBe("2026-10-01..2026-10-01");
    expect(days(oneDay!)).toBe("2026-10-05..2026-10-05");
  });

  it("keys repeated ids apart and sorts by start, the longer first, then input order", () => {
    const placed = placeEvents([
      ev("x", d(2026, 10, 1, 10), d(2026, 10, 1, 11)),
      ev("x", d(2026, 10, 1, 9), d(2026, 10, 1, 10)),
      ev("long", d(2026, 10, 1, 9), d(2026, 10, 1, 12)),
      ev("tie", d(2026, 10, 1, 9), d(2026, 10, 1, 10)),
    ]);
    expect(placed.map((p) => p.key)).toEqual(["long", "x~1", "tie", "x"]);
  });

  it("reads at most MAX_EVENTS events", () => {
    const many = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => ev(String(i), d(2026, 10, 1, 9)));
    expect(placeEvents(many)).toHaveLength(MAX_EVENTS);
  });
});

describe("periods", () => {
  it("shows a month, a week from the week start, or a day", () => {
    const date = d(2026, 10, 15); // a Thursday
    const iso = (p: { start: Date; end: Date }) => `${toISODate(p.start)}..${toISODate(p.end)}`;
    expect(iso(periodOf("month", date, 1))).toBe("2026-10-01..2026-11-01");
    expect(iso(periodOf("agenda", date, 1))).toBe("2026-10-01..2026-11-01");
    expect(iso(periodOf("week", date, 1))).toBe("2026-10-12..2026-10-19");
    expect(iso(periodOf("week", date, 0))).toBe("2026-10-11..2026-10-18");
    expect(iso(periodOf("day", date, 1))).toBe("2026-10-15..2026-10-16");
  });

  it("steps a month keeping the day, clamped", () => {
    expect(toISODate(stepDate("month", d(2026, 1, 31), 1))).toBe("2026-02-28");
    expect(toISODate(stepDate("week", d(2026, 10, 30), 1))).toBe("2026-11-06");
    expect(toISODate(stepDate("day", d(2026, 11, 1), -1))).toBe("2026-10-31");
  });

  it("draws every week holding a day of the month, whole", () => {
    // February 2026 starts on a Sunday: four Sunday-first weeks, five Monday-first.
    expect(monthWeeks(d(2026, 2, 10), 0)).toHaveLength(4);
    expect(monthWeeks(d(2026, 2, 10), 1)).toHaveLength(5);
    const weeks = monthWeeks(d(2026, 8, 1), 0); // August 2026: Saturday the 1st, Monday the 31st
    expect(weeks).toHaveLength(6);
    expect(toISODate(weeks[0]![0]!)).toBe("2026-07-26");
    expect(toISODate(weeks[5]![6]!)).toBe("2026-09-05");
  });
});

describe("layoutRow", () => {
  const week = d(2026, 10, 12); // Monday

  it("packs a multi-day event into one lane across its days, cut at the row's edges", () => {
    const placed = placeEvents([ev("window", "2026-10-10", "2026-10-13"), ev("talk", d(2026, 10, 13, 9), d(2026, 10, 13, 10))]);
    const { segments, hidden } = layoutRow(placed, week, 7, 3);
    const win = segments.find((s) => s.placed.key === "window");
    expect(win).toMatchObject({ column: 0, span: 2, lane: 0, continuesBefore: true, continuesAfter: false });
    expect(segments.find((s) => s.placed.key === "talk")).toMatchObject({ column: 1, span: 1, lane: 1 });
    expect(hidden).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("gives a crowded day's last lane to '+n more' and counts what it hides", () => {
    const placed = placeEvents(
      ["a", "b", "c", "d"].map((id, i) => ev(id, d(2026, 10, 14, 9 + i), d(2026, 10, 14, 10 + i))),
    );
    const { segments, hidden, events } = layoutRow(placed, week, 7, 3);
    expect(events[2]).toHaveLength(4);
    // Lanes 0 and 1 drawn, lane 2 is "+2 more".
    expect(segments.map((s) => s.lane)).toEqual([0, 1]);
    expect(hidden[2]).toBe(2);
    expect(hidden.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("hides a spanning event on every day it covers when one of them is crowded", () => {
    // Two Mon–Tue bars take lanes 0 and 1, so the Tue–Thu bar lands in lane 2;
    // Tuesday has four events and gives lane 2 to "+n more", so the bar is hidden
    // there and on Wednesday and Thursday too, which then say "+1 more".
    const placed = placeEvents([
      ev("x", "2026-10-12", "2026-10-13"),
      ev("y", "2026-10-12", "2026-10-13"),
      ev("bar", "2026-10-13", "2026-10-15"),
      ev("tue", d(2026, 10, 13, 9), d(2026, 10, 13, 10)),
    ]);
    const { segments, hidden } = layoutRow(placed, week, 7, 3);
    expect(segments.map((s) => `${s.placed.key}@${s.lane}`)).toEqual(["x@0", "y@1"]);
    expect(hidden).toEqual([0, 2, 1, 1, 0, 0, 0]);
  });

  it("over random rows: every day's drawn and hidden events add up, and '+n more' never shares a lane", () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const iso = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
    let rows = 0;
    let crowded = 0;
    for (let t = 0; t < 3000; t += 1) {
      const events = Array.from({ length: 1 + rnd(9) }, (_, i) => {
        const start = 10 + rnd(9);
        return ev(String(i), iso(start), iso(start + rnd(4)));
      });
      const maxLanes = 1 + rnd(3);
      const layout = layoutRow(placeEvents(events), week, 7, maxLanes);
      for (let col = 0; col < 7; col += 1) {
        const here = layout.segments.filter((s) => col >= s.column && col < s.column + s.span);
        const hidden = layout.hidden[col] ?? 0;
        expect(here.length + hidden).toBe(layout.events[col]!.length);
        expect(here.every((s) => s.lane < (hidden > 0 ? maxLanes - 1 : maxLanes))).toBe(true);
        if (hidden > 0) crowded += 1;
      }
      rows += 1;
    }
    // The generator does make crowded days, or the lane rule went unexercised.
    expect(rows).toBe(3000);
    expect(crowded).toBeGreaterThan(500);
  });

  it("with one lane, shows only '+n more' on a day with two events", () => {
    const placed = placeEvents([ev("a", d(2026, 10, 12, 9)), ev("b", d(2026, 10, 12, 10))]);
    const { segments, hidden } = layoutRow(placed, week, 7, 1);
    expect(segments).toHaveLength(0);
    expect(hidden[0]).toBe(2);
  });
});

describe("layoutDay", () => {
  const day = d(2026, 10, 15);

  it("puts overlapping events side by side and widens a block over free tracks", () => {
    const placed = placeEvents([
      ev("a", d(2026, 10, 15, 9), d(2026, 10, 15, 11)),
      ev("b", d(2026, 10, 15, 9, 30), d(2026, 10, 15, 10)),
      ev("c", d(2026, 10, 15, 10, 30), d(2026, 10, 15, 11, 30)),
      ev("solo", d(2026, 10, 15, 14), d(2026, 10, 15, 15)),
    ]);
    const segs = Object.fromEntries(layoutDay(placed, day).map((s) => [s.placed.key, s]));
    expect(segs.a).toMatchObject({ column: 0, columns: 2, span: 1, startMinute: 540, endMinute: 660 });
    expect(segs.b).toMatchObject({ column: 1, columns: 2, span: 1 });
    // c starts after b ends, so it takes b's track.
    expect(segs.c).toMatchObject({ column: 1, columns: 2 });
    expect(segs.solo).toMatchObject({ column: 0, columns: 1, span: 1 });
  });

  it("widens a block over the tracks after it that are free for its whole height", () => {
    const placed = placeEvents([
      ev("long", d(2026, 10, 15, 9), d(2026, 10, 15, 12)),
      ev("b", d(2026, 10, 15, 9), d(2026, 10, 15, 10)),
      ev("c", d(2026, 10, 15, 9), d(2026, 10, 15, 10)),
      ev("later", d(2026, 10, 15, 10), d(2026, 10, 15, 12)),
    ]);
    const segs = Object.fromEntries(layoutDay(placed, day).map((s) => [s.placed.key, s]));
    expect(segs.long).toMatchObject({ column: 0, columns: 3, span: 1 });
    expect(segs.b).toMatchObject({ column: 1, columns: 3, span: 1 });
    expect(segs.c).toMatchObject({ column: 2, columns: 3, span: 1 });
    // `later` takes b's track once b ends, and c's track is free beside it.
    expect(segs.later).toMatchObject({ column: 1, columns: 3, span: 2 });
  });

  it("clips a cross-midnight event to each day and leaves day-long ones to the all-day lane", () => {
    const placed = placeEvents([
      ev("migration", d(2026, 10, 15, 23), d(2026, 10, 16, 2, 30)),
      ev("oncall", d(2026, 10, 15, 9), d(2026, 10, 16, 9)),
      ev("allday", "2026-10-15"),
    ]);
    const first = layoutDay(placed, day);
    expect(first.map((s) => s.placed.key)).toEqual(["migration"]);
    expect(first[0]).toMatchObject({ startMinute: 1380, endMinute: 1440, continuesBefore: false, continuesAfter: true });
    const second = layoutDay(placed, d(2026, 10, 16));
    expect(second[0]).toMatchObject({ startMinute: 0, endMinute: 150, continuesBefore: true, continuesAfter: false });
  });

  it("draws a moment at least MIN_BLOCK_MINUTES tall, and overlaps by that height", () => {
    const placed = placeEvents([ev("ping", d(2026, 10, 15, 9)), ev("next", d(2026, 10, 15, 9, 15), d(2026, 10, 15, 9, 20))]);
    const segs = layoutDay(placed, day);
    expect(drawnEnd(segs[0]!)).toBe(570);
    expect(segs.map((s) => s.columns)).toEqual([2, 2]);
  });

  it("reads wall-clock minutes on a DST day", () => {
    // 1 Nov 2026 in New York: 01:00–02:00 happens twice; 09:00 is still minute 540.
    const dst = d(2026, 11, 1);
    const placed = placeEvents([ev("standup", d(2026, 11, 1, 9), d(2026, 11, 1, 9, 30))]);
    expect(layoutDay(placed, dst)[0]).toMatchObject({ startMinute: 540, endMinute: 570 });
    expect(minuteOfDay(d(2026, 11, 1, 13, 15).getTime(), dst)).toBe(795);
    expect(minuteOfDay(d(2026, 11, 2, 13).getTime(), dst)).toBeNull();
  });
});
