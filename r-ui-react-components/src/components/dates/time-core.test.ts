import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  formatTimeLabel,
  formatTimeValue,
  hourCycleFor,
  isTimeAllowed,
  parseTimeValue,
  segmentTexts,
  timeLayout,
  timeSlots,
  toISODateTime,
  withTimeOfDay,
} from "./time-core";

const t = (text: string) => {
  const parsed = parseTimeValue(text);
  if (!parsed) throw new Error(`fixture: ${text} is not a time`);
  return parsed;
};

describe("parseTimeValue / formatTimeValue", () => {
  it("reads 24-hour wire strings and writes them back two digits wide", () => {
    expect(parseTimeValue("09:30")).toEqual({ hour: 9, minute: 30, second: 0 });
    expect(parseTimeValue("9:30")).toEqual({ hour: 9, minute: 30, second: 0 });
    expect(parseTimeValue("23:59:58")).toEqual({ hour: 23, minute: 59, second: 58 });
    expect(formatTimeValue(t("9:05"))).toBe("09:05");
    expect(formatTimeValue(t("23:59:58"), true)).toBe("23:59:58");
  });

  it("refuses what names no time of day", () => {
    for (const text of ["", "24:00", "12:60", "9", "09:3", "09:30:61", "9.30", "09:30 PM", null, undefined]) {
      expect(parseTimeValue(text), String(text)).toBeNull();
    }
  });
});

describe("isTimeAllowed / timeSlots", () => {
  it("bounds are inclusive; a min after max is a window across midnight", () => {
    expect(isTimeAllowed(t("09:00"), t("09:00"), t("17:30"))).toBe(true);
    expect(isTimeAllowed(t("17:30"), t("09:00"), t("17:30"))).toBe(true);
    expect(isTimeAllowed(t("17:31"), t("09:00"), t("17:30"))).toBe(false);
    expect(isTimeAllowed(t("23:00"), t("22:00"), t("06:00"))).toBe(true);
    expect(isTimeAllowed(t("05:59"), t("22:00"), t("06:00"))).toBe(true);
    expect(isTimeAllowed(t("12:00"), t("22:00"), t("06:00"))).toBe(false);
    expect(isTimeAllowed(t("00:00"))).toBe(true);
  });

  it("lists the day at a stride, or a window across midnight", () => {
    const day = timeSlots(30).map((s) => formatTimeValue(s));
    expect(day).toHaveLength(48);
    expect([day[0], day[1], day.at(-1)]).toEqual(["00:00", "00:30", "23:30"]);
    expect(timeSlots(15, t("09:00"), t("10:00")).map((s) => formatTimeValue(s))).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00"]);
    expect(timeSlots(60, t("22:00"), t("01:00")).map((s) => formatTimeValue(s))).toEqual(["22:00", "23:00", "00:00", "01:00"]);
  });
});

describe("locale clocks", () => {
  it("takes the locale's clock unless the caller picks one", () => {
    expect(hourCycleFor("en-US")).toBe("h12");
    expect(hourCycleFor("de-DE")).toBe("h23");
    expect(hourCycleFor("en-US", 24)).toBe("h23");
    expect(hourCycleFor("de-DE", 12)).toBe("h12");
  });

  it("lays segments out in the locale's order with its separators", () => {
    const kinds = (locale: string, cycle: "h12" | "h23", seconds = false) =>
      timeLayout(locale, cycle, seconds).parts.map((p) => (p.type === "literal" ? p.value : `<${p.type}>`)).join("");
    // ICU separates the day period with a space or a narrow no-break space, by version.
    expect(kinds("en-US", "h12")).toMatch(/^<hour>:<minute>\s<dayPeriod>$/);
    expect(kinds("de-DE", "h23", true)).toBe("<hour>:<minute>:<second>");
    expect(kinds("fi-FI", "h23")).toBe("<hour>.<minute>");
    expect(kinds("ko-KR", "h12")).toMatch(/^<dayPeriod>\s<hour>:<minute>$/);
    expect(timeLayout("en-US", "h12", false)).toMatchObject({ am: "AM", pm: "PM" });
  });

  it("writes segments in the locale's digits, the hour on its clock", () => {
    expect(segmentTexts(t("21:05"), "en-US", "h12")).toEqual({ hour: "09", minute: "05", second: "00" });
    expect(segmentTexts(t("21:05"), "de-DE", "h23")).toEqual({ hour: "21", minute: "05", second: "00" });
    expect(segmentTexts(t("09:05"), "ar-EG", "h12").hour).toBe("٠٩");
    expect(formatTimeLabel(t("17:30"), "en-US", "h12")).toMatch(/^5:30\sPM$/);
    expect(formatTimeLabel(t("17:30"), "de-DE", "h23")).toBe("17:30");
  });
});

describe("date-times on the wall clock (Europe/Berlin)", () => {
  const saved = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Berlin";
  });
  afterAll(() => {
    // Assigning `undefined` would set the zone to the string "undefined".
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  });

  it("harness: the zone took effect (winter +01:00, summer +02:00)", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(-60);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-120);
  });

  it("writes the local wall clock with its offset, never UTC", () => {
    expect(toISODateTime(withTimeOfDay(new Date(2026, 9, 15), t("09:30")))).toBe("2026-10-15T09:30+02:00");
    expect(toISODateTime(withTimeOfDay(new Date(2026, 0, 15), t("00:00")))).toBe("2026-01-15T00:00+01:00");
    expect(toISODateTime(new Date(2026, 0, 15, 23, 59, 7), { seconds: true })).toBe("2026-01-15T23:59:07+01:00");
  });

  it("a time a DST change skips moves forward by the gap; a repeated one is the earlier instant", () => {
    // 29 March 2026: 02:00 jumps to 03:00.
    expect(toISODateTime(withTimeOfDay(new Date(2026, 2, 29), t("02:30")))).toBe("2026-03-29T03:30+02:00");
    // 25 October 2026: 03:00 falls back to 02:00, so 02:30 happens twice.
    const overlap = withTimeOfDay(new Date(2026, 9, 25), t("02:30"));
    expect(toISODateTime(overlap)).toBe("2026-10-25T02:30+02:00");
    expect(withTimeOfDay(new Date(2026, 9, 25), t("03:30")).getTime() - overlap.getTime()).toBe(2 * 3_600_000);
  });
});
