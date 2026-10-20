// @vitest-environment node
import { describe, expect, it } from "vitest";

import { digitsAccepted, isCurrencyCode, isIntlUnit } from "./validate-values";

describe("Intl inputs", () => {
  it("accepts what Intl constructs and refuses what it throws on", () => {
    expect([isCurrencyCode("EUR"), isCurrencyCode("eur"), isCurrencyCode("EURO"), isCurrencyCode("")]).toEqual([true, true, false, false]);
    expect([isIntlUnit("millisecond"), isIntlUnit("kilometer-per-hour"), isIntlUnit("furlong")]).toEqual([true, true, false]);
    expect([digitsAccepted({ minimumFractionDigits: 1, maximumFractionDigits: 2 }), digitsAccepted({ minimumFractionDigits: 3, maximumFractionDigits: 2 })]).toEqual([true, false]);
  });
});
