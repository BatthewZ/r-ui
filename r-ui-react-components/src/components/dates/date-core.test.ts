import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  formatInputDate,
  formatPattern,
  makeDate,
  monthGrid,
  parseDate,
  parseISODate,
  toISODate,
  weekdayNames,
  weekStartFor,
} from "./date-core";

const iso = (d: Date | null) => (d ? toISODate(d) : null);

describe("parseDate", () => {
  it("reads numbers in the locale's own field order", () => {
    expect(iso(parseDate("10/15/2026", "en-US"))).toBe("2026-10-15");
    expect(iso(parseDate("15.10.2026", "de-DE"))).toBe("2026-10-15");
    expect(iso(parseDate("15/10/2026", "en-GB"))).toBe("2026-10-15");
    // The same text, two locales, two dates.
    expect(iso(parseDate("03/04/2026", "en-US"))).toBe("2026-03-04");
    expect(iso(parseDate("03/04/2026", "de-DE"))).toBe("2026-04-03");
  });

  it("takes any separator, single digits and two-digit years (as 20yy)", () => {
    expect(iso(parseDate("1-5-26", "en-US"))).toBe("2026-01-05");
    expect(iso(parseDate(" 5 1 2026 ", "de-DE"))).toBe("2026-01-05");
  });

  it("reads ISO in every locale, and month names in any order", () => {
    expect(iso(parseDate("2026-10-15", "en-US"))).toBe("2026-10-15");
    expect(iso(parseDate("2026-10-15", "de-DE"))).toBe("2026-10-15");
    expect(iso(parseDate("October 15, 2026", "en-US"))).toBe("2026-10-15");
    expect(iso(parseDate("15 Okt. 2026", "de-DE"))).toBe("2026-10-15");
    expect(iso(parseDate("15. März 2026", "de-DE"))).toBe("2026-03-15");
  });

  it("reads the locale's own digits", () => {
    const typed = formatInputDate(new Date(2026, 9, 15), "ar-EG");
    expect(typed).toMatch(/[٠-٩]/);
    expect(iso(parseDate(typed, "ar-EG"))).toBe("2026-10-15");
  });

  it("refuses text that names no calendar date", () => {
    for (const text of ["", "   ", "13/45/2026", "02/30/2026", "15.10.2026", "hello", "10/15", "10/15/20261", "2026-02-30"]) {
      expect(parseDate(text, "en-US"), text).toBeNull();
    }
    expect(parseDate("31.04.2026", "de-DE")).toBeNull();
  });

  it("round-trips what the field shows", () => {
    for (const locale of ["en-US", "de-DE", "en-GB", "ja-JP", "fr-CA"]) {
      const d = new Date(2026, 0, 9);
      expect(iso(parseDate(formatInputDate(d, locale), locale)), locale).toBe("2026-01-09");
    }
  });
});

describe("calendar arithmetic", () => {
  it("builds a year below 100 as that year, not 19yy", () => {
    expect(makeDate(26, 0, 1)?.getFullYear()).toBe(26);
    expect(parseISODate("0026-01-01")?.getFullYear()).toBe(26);
  });

  it("clamps a month step to the target month's last day", () => {
    expect(toISODate(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(toISODate(addMonths(new Date(2028, 0, 31), 1))).toBe("2028-02-29");
    expect(toISODate(addMonths(new Date(2026, 2, 31), -12))).toBe("2025-03-31");
  });

  it("steps days by the calendar, returning local midnight", () => {
    const d = addDays(new Date(2026, 9, 31, 18, 30), 1);
    expect(toISODate(d)).toBe("2026-11-01");
    expect(d.getHours()).toBe(0);
  });

  it("lays a month out in six weeks from the week start, other months blank", () => {
    const grid = monthGrid(new Date(2026, 9, 1), 0);
    expect(grid).toHaveLength(6);
    // 1 October 2026 is a Thursday.
    expect(grid[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    expect(iso(grid[0]?.[4] ?? null)).toBe("2026-10-01");
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(iso(monthGrid(new Date(2026, 9, 1), 1)[0]?.[3] ?? null)).toBe("2026-10-01");
  });
});

describe("locale data", () => {
  it("starts the week where the locale does", () => {
    expect(weekStartFor("en-US")).toBe(0);
    expect(weekStartFor("de-DE")).toBe(1);
    expect(weekStartFor("en-GB")).toBe(1);
    expect(weekStartFor("ar-EG")).toBe(6);
  });

  it("names weekdays from the week start, long names for assistive tech", () => {
    const names = weekdayNames("de-DE", 1);
    expect(names[0]?.long).toBe("Montag");
    expect(names[6]?.long).toBe("Sonntag");
    expect(weekdayNames("en-US", 0)[0]).toEqual({ short: "Sun", long: "Sunday" });
  });

  it("shows the pattern the field accepts, with translatable letters", () => {
    expect(formatPattern("en-US")).toBe("MM/DD/YYYY");
    expect(formatPattern("de-DE")).toBe("DD.MM.YYYY");
    expect(formatPattern("de-DE", { day: "TT", month: "MM", year: "JJJJ" })).toBe("TT.MM.JJJJ");
  });
});
