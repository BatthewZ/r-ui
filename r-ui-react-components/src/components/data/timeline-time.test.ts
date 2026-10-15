import { afterAll, describe, expect, it } from "vitest";

import { dayKey, datetimeAttr, formatDay, formatRelative, parseTime } from "./timeline-time";

// West of Greenwich, where reading a bare date as UTC midnight lands on the previous day.
// Set before any local Date below is built.
const originalTz = process.env.TZ;
process.env.TZ = "America/Los_Angeles";
afterAll(() => {
  process.env.TZ = originalTz;
});

const NOW = new Date(2026, 9, 15, 12, 0).getTime();

describe("timeline time", () => {
  it("harness: the zone is west of Greenwich, so a UTC-parsed date moves back a day", () => {
    expect(new Date("2026-10-14").getDate()).toBe(13);
  });

  it("reads a bare YYYY-MM-DD as a local calendar date, and gives it back unchanged", () => {
    const t = parseTime("2026-10-14");
    expect(t.allDay).toBe(true);
    expect(new Date(t.ms).getDate()).toBe(14);
    expect(dayKey(t.ms)).toBe("2026-10-14");
    expect(datetimeAttr(t)).toBe("2026-10-14");
  });

  it("reads a year below 100 as itself, not 19yy", () => {
    expect(dayKey(parseTime("0042-03-01").ms)).toBe("0042-03-01");
  });

  it("keeps an instant an instant: the datetime is the UTC ISO string", () => {
    const t = parseTime("2026-10-15T09:30:00Z");
    expect(t.allDay).toBe(false);
    expect(datetimeAttr(t)).toBe("2026-10-15T09:30:00.000Z");
  });

  it("marks what is not a time as missing", () => {
    expect(parseTime("not a date").ms).toBeNaN();
    expect(parseTime("").ms).toBeNaN();
    expect(parseTime(new Date(Number.NaN)).ms).toBeNaN();
  });

  it("marks an epoch number outside the Date range as missing (nanoseconds passed as ms)", () => {
    expect(parseTime(1.7e18).ms).toBeNaN();
    expect(parseTime(-9e15).ms).toBeNaN();
    expect(parseTime(8.64e15).ms).toBe(8.64e15);
  });

  it("counts a calendar date in calendar days, never hours", () => {
    expect(formatRelative(parseTime("2026-10-14"), NOW, "en")).toBe("yesterday");
    expect(formatRelative(parseTime("2026-10-15"), NOW, "en")).toBe("today");
    expect(formatRelative(parseTime("2026-10-17"), NOW, "en")).toBe("in 2 days");
  });

  it("picks the largest whole unit, past and future", () => {
    const at = (min: number) => parseTime(NOW + min * 60_000);
    expect(formatRelative(at(0), NOW, "en")).toBe("now");
    expect(formatRelative(at(-5), NOW, "en")).toBe("5 minutes ago");
    expect(formatRelative(at(-180), NOW, "en")).toBe("3 hours ago");
    expect(formatRelative(at(3 * 24 * 60), NOW, "en")).toBe("in 3 days");
    expect(formatRelative(at(-14 * 24 * 60), NOW, "en")).toBe("2 weeks ago");
    expect(formatRelative(at(-400 * 24 * 60), NOW, "en")).toBe("last year");
  });

  it("names nearby days in words and others by date, with the year only when it differs", () => {
    expect(formatDay(new Date(2026, 9, 15, 23, 59).getTime(), NOW, "en")).toBe("Today");
    expect(formatDay(new Date(2026, 9, 14, 0, 1).getTime(), NOW, "en")).toBe("Yesterday");
    expect(formatDay(new Date(2026, 9, 16).getTime(), NOW, "en")).toBe("Tomorrow");
    expect(formatDay(new Date(2026, 9, 12).getTime(), NOW, "en-GB")).toBe("Mon 12 Oct");
    expect(formatDay(new Date(2025, 9, 12).getTime(), NOW, "en-GB")).toBe("Sun, 12 Oct 2025");
  });
});

describe("timeline time with a malformed locale", () => {
  it("falls back to the runtime default instead of throwing mid-render", () => {
    const t = parseTime(new Date(NOW - 5 * 60_000));
    expect(() => new Intl.RelativeTimeFormat("not a locale!")).toThrow(RangeError);
    expect(formatRelative(t, NOW, "not a locale!")).toBe(formatRelative(t, NOW));
    expect(formatDay(NOW, NOW, "not a locale!")).toBe(formatDay(NOW, NOW));
  });
});
