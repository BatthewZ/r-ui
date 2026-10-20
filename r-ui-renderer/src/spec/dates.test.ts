// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { isIsoDate, isIsoDateTime, parseIsoDate, parseIsoDateTime } from "./dates";

describe("ISO dates, strictly", () => {
  it.each([
    ["2026-11-02", true, true],
    ["2024-02-29", true, true],
    ["2026-02-29", false, false],
    ["2100-02-29", false, false],
    ["2000-02-29", true, true],
    ["2026-13-01", false, false],
    ["2026-1-01", false, false],
    ["2026-11-02T09:30", false, true],
    ["2026-11-02T09:30:59.123Z", false, true],
    ["2026-11-02t09:30z", false, true],
    ["2026-11-02T09:30:00+05:30", false, true],
    ["2026-11-02T24:00", false, false],
    ["2026-11-02T09:60", false, false],
    ["2026-11-02T09:30+24:00", false, false],
    ["2026-11-02 09:30", false, false],
  ])("%s: a date %s, a date or date-time %s", (text, date, dateTime) => {
    expect(isIsoDate(text)).toBe(date);
    expect(isIsoDateTime(text)).toBe(dateTime);
  });
});

describe("ISO text to Dates", () => {
  const zone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zone;
  });

  it.each(["America/Los_Angeles", "Pacific/Auckland"])("reads a bare date as that local calendar day in %s", (tz) => {
    process.env.TZ = tz;
    const date = parseIsoDate("2026-11-02");
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate(), date?.getHours()]).toEqual([2026, 10, 2, 0]);
  });

  it("reads an offset as that instant, no offset as local time, and keeps years under 100", () => {
    expect(parseIsoDateTime("2026-11-02T09:30:00Z")?.toISOString()).toBe("2026-11-02T09:30:00.000Z");
    expect(parseIsoDateTime("2026-11-02T09:30:00+02:00")?.toISOString()).toBe("2026-11-02T07:30:00.000Z");
    const local = parseIsoDateTime("2026-11-02T09:30");
    expect([local?.getDate(), local?.getHours(), local?.getMinutes()]).toEqual([2, 9, 30]);
    expect(parseIsoDate("0099-01-01")?.getFullYear()).toBe(99);
  });

  it.each(["2026-02-30", "2026-13-01", "2025-02-29", "2026-1-2", "2026-11-02T24:00", "2026-11-02T10:00+25:00", "soon"])(
    "refuses %j",
    (text) => {
      expect(parseIsoDateTime(text)).toBeNull();
    },
  );

  it("accepts 29 February in a leap year", () => {
    expect(parseIsoDate("2028-02-29")?.getDate()).toBe(29);
  });
});
