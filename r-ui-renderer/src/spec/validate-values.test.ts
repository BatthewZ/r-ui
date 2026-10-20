// @vitest-environment node
import { describe, expect, it } from "vitest";

import { digitsAccepted, isCurrencyCode, isIntlUnit, isIsoDate, isIsoDateTime } from "./validate-values";

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

describe("Intl inputs", () => {
  it("accepts what Intl constructs and refuses what it throws on", () => {
    expect([isCurrencyCode("EUR"), isCurrencyCode("eur"), isCurrencyCode("EURO"), isCurrencyCode("")]).toEqual([true, true, false, false]);
    expect([isIntlUnit("millisecond"), isIntlUnit("kilometer-per-hour"), isIntlUnit("furlong")]).toEqual([true, true, false]);
    expect([digitsAccepted({ minimumFractionDigits: 1, maximumFractionDigits: 2 }), digitsAccepted({ minimumFractionDigits: 3, maximumFractionDigits: 2 })]).toEqual([true, false]);
  });
});
