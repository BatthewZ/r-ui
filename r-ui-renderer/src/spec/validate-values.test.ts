// @vitest-environment node
import { describe, expect, it } from "vitest";

import { digitsAccepted, isCurrencyCode, isIntlUnit } from "./validate-values";

describe("Intl inputs", () => {
  it("accepts what Intl constructs and refuses what it throws on", () => {
    expect([isCurrencyCode("EUR"), isCurrencyCode("eur"), isCurrencyCode("EURO"), isCurrencyCode("")]).toEqual([true, true, false, false]);
    expect([isIntlUnit("millisecond"), isIntlUnit("kilometer-per-hour"), isIntlUnit("furlong")]).toEqual([true, true, false]);
    expect([digitsAccepted({ minimumFractionDigits: 1, maximumFractionDigits: 2 }), digitsAccepted({ minimumFractionDigits: 3, maximumFractionDigits: 2 })]).toEqual([true, false]);
  });

  it("judges crossed fraction digits only where they reach Intl, as the renderer's formatting does", () => {
    const crossed = { minimumFractionDigits: 3, maximumFractionDigits: 2 };
    // Significant digits take over from fraction digits; `integer` sets its own; dates read neither.
    expect(digitsAccepted({ ...crossed, style: "number", maximumSignificantDigits: 3 })).toBe(true);
    for (const style of ["integer", "date", "datetime", "time"]) expect(digitsAccepted({ ...crossed, style })).toBe(true);
    for (const style of ["number", "compact", "percent", "delta", "bytes", "currency", "unit"]) expect(digitsAccepted({ ...crossed, style })).toBe(false);
  });
});
