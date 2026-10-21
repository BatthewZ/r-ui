import { afterAll, describe, expect, it } from "vitest";

import { modelCartesian } from "./chart-model";

// West of Greenwich, where a bare date read as UTC midnight lands on the previous day.
// Set before any local Date below is built.
const originalTz = process.env.TZ;
process.env.TZ = "America/Los_Angeles";
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const series = [{ name: "Signups", values: [3, 5] }];

describe("modelCartesian: string x on a time axis", () => {
  it("harness: the zone is west of Greenwich, so a UTC-parsed date moves back a day", () => {
    expect(new Date(Date.parse("2026-03-01")).getDate()).toBe(28);
  });

  it("reads a bare YYYY-MM-DD as that local calendar day, labelled like the same day given as a Date", () => {
    const fromStrings = modelCartesian({ x: ["2026-03-01", "2026-03-02"], series, xType: "time", locale: "en-US" });
    const fromDates = modelCartesian({ x: [new Date(2026, 2, 1), new Date(2026, 2, 2)], series, locale: "en-US" });
    expect(fromDates.rows.map((r) => r.label)).toEqual(["Sun, Mar 1, 2026", "Mon, Mar 2, 2026"]);
    expect(fromStrings.rows.map((r) => r.x)).toEqual(fromDates.rows.map((r) => r.x));
    expect(fromStrings.rows.map((r) => r.label)).toEqual(["Sun, Mar 1, 2026", "Mon, Mar 2, 2026"]);
  });

  it("reads a bare date as UTC midnight when the chart reads time in UTC", () => {
    const m = modelCartesian({ x: ["2026-03-01", "2026-03-02"], series, xType: "time", timeZone: "UTC" });
    expect(m.rows.map((r) => r.x)).toEqual([Date.UTC(2026, 2, 1), Date.UTC(2026, 2, 2)]);
  });

  it("leaves an instant (a date-time with an offset) as the instant it names", () => {
    const m = modelCartesian({ x: ["2026-03-01T12:00:00Z"], series, xType: "time" });
    expect(m.rows[0]?.x).toBe(Date.UTC(2026, 2, 1, 12));
  });

  it("drops an impossible calendar date instead of rolling it over", () => {
    const m = modelCartesian({ x: ["2026-13-01", "2026-03-02"], series, xType: "time" });
    expect(m.rows.map((r) => r.x)).toEqual([new Date(2026, 2, 2).getTime(), null]);
  });
});
