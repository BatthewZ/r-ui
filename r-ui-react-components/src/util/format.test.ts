import { describe, expect, it } from "vitest";

import {
  dateTimeFormatter,
  formatBytes,
  formatCompact,
  formatDelta,
  formatNumber,
  formatPercent,
  formatUnit,
  isPresent,
  MISSING,
  relativeTimeFormatter,
} from "./format";

const en = { locale: "en-US" } as const;
const de = { locale: "de-DE" } as const;
/** Intl separates number and unit with a no-break space in some locales; compare on plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("missing values", () => {
  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "renders %s as an em dash in every formatter",
    (value) => {
      expect(MISSING).toBe("—");
      expect(formatNumber(value, en)).toBe("—");
      expect(formatCompact(value, en)).toBe("—");
      expect(formatPercent(value, en)).toBe("—");
      expect(formatUnit(value, "millisecond", en)).toBe("—");
      expect(formatDelta(value, en)).toBe("—");
      expect(formatBytes(value, en)).toBe("—");
    },
  );

  it("keeps zero a number, never missing", () => {
    expect(isPresent(0)).toBe(true);
    expect(formatNumber(0, en)).toBe("0");
    expect(formatPercent(0, en)).toBe("0%");
  });

  it("accepts a caller's own missing text", () => {
    expect(formatNumber(null, { ...en, missing: "n/a" })).toBe("n/a");
    expect(formatBytes(undefined, { ...en, missing: "n/a" })).toBe("n/a");
  });
});

describe("formatNumber", () => {
  it("groups and marks decimals by locale", () => {
    expect(formatNumber(1234567.891, en)).toBe("1,234,567.891");
    expect(formatNumber(1234567.891, de)).toBe("1.234.567,891");
  });

  it("formats negatives with the locale's sign", () => {
    expect(formatNumber(-1234.5, en)).toBe("-1,234.5");
  });

  it("never prints a negative zero", () => {
    expect(formatNumber(-0.4, { ...en, maximumFractionDigits: 0 })).toBe("0");
    expect(formatNumber(-0, en)).toBe("0");
    expect(formatCompact(-0.01, en)).toBe("0");
  });

  it("passes Intl options through", () => {
    expect(formatNumber(3.14159, { ...en, maximumFractionDigits: 2 })).toBe("3.14");
    expect(formatNumber(1234, { ...en, style: "currency", currency: "EUR" })).toBe("€1,234.00");
  });
});

describe("formatCompact", () => {
  it("abbreviates thousands, millions and billions with one fraction digit", () => {
    expect(formatCompact(1234, en)).toBe("1.2K");
    expect(formatCompact(2_500_000, en)).toBe("2.5M");
    expect(formatCompact(7_000_000_000, en)).toBe("7B");
    expect(formatCompact(999, en)).toBe("999");
  });

  it("handles negatives and huge values", () => {
    expect(formatCompact(-1234, en)).toBe("-1.2K");
    expect(formatCompact(1.5e15, en)).toBe("1500T");
  });

  it("uses the locale's suffix", () => {
    expect(plain(formatCompact(1_200_000, de))).toBe("1,2 Mio.");
  });
});

describe("formatPercent", () => {
  it("takes a ratio, not a percent", () => {
    expect(formatPercent(0.123, en)).toBe("12.3%");
    expect(formatPercent(1, en)).toBe("100%");
    expect(formatPercent(-0.05, en)).toBe("-5%");
  });

  it("respects locale and precision", () => {
    expect(plain(formatPercent(0.1234, { ...de, maximumFractionDigits: 2 }))).toBe("12,34 %");
  });

  // The one-digit default cap must yield to a larger minimum, or Intl throws.
  it("takes a minimum fraction above the default cap", () => {
    expect(formatPercent(0.123, { ...en, minimumFractionDigits: 2 })).toBe("12.30%");
    expect(formatCompact(1234, { ...en, minimumFractionDigits: 2 })).toBe("1.23K");
    expect(plain(formatBytes(1536, { ...en, minimumFractionDigits: 2 }))).toBe("1.50 kB");
  });
});

describe("formatUnit", () => {
  it("names the unit in short form by default", () => {
    expect(plain(formatUnit(120, "millisecond", en))).toBe("120 ms");
    expect(plain(formatUnit(3.5, "megabyte", en))).toBe("3.5 MB");
    expect(plain(formatUnit(-4, "celsius", en))).toBe("-4°C");
  });

  it("can spell the unit out", () => {
    expect(formatUnit(2, "hour", { ...en, unitDisplay: "long" })).toBe("2 hours");
  });
});

describe("formatDelta", () => {
  it("signs every non-zero change and leaves zero unsigned", () => {
    expect(formatDelta(12, en)).toBe("+12");
    expect(formatDelta(-3.5, en)).toBe("-3.5");
    expect(formatDelta(0, en)).toBe("0");
  });

  it("composes with percent style for relative change", () => {
    expect(formatDelta(0.042, { ...en, style: "percent", maximumFractionDigits: 1 })).toBe("+4.2%");
  });
});

describe("formatBytes", () => {
  it("picks the largest unit that keeps the number at least 1 (base 1024)", () => {
    expect(plain(formatBytes(512, en))).toBe("512 byte");
    expect(plain(formatBytes(1536, en))).toBe("1.5 kB");
    expect(plain(formatBytes(5 * 1024 ** 3, en))).toBe("5 GB");
  });

  it("keeps the sign of a negative size", () => {
    expect(plain(formatBytes(-2048, en))).toBe("-2 kB");
  });

  it("steps up a unit when rounding reaches 1024", () => {
    expect(plain(formatBytes(1024 ** 2 - 1, en))).toBe("1 MB");
    expect(plain(formatBytes(-(1024 ** 2 - 1), en))).toBe("-1 MB");
    expect(plain(formatBytes(1023.6, en))).toBe("1 kB");
    // Just below the rounding edge stays in the smaller unit.
    expect(plain(formatBytes(1023 * 1024, en))).toBe("1,023 kB");
    expect(plain(formatBytes(1024 ** 2 - 1, { ...en, maximumFractionDigits: 3 }))).toBe("1,023.999 kB");
  });
});

describe("dateTimeFormatter / relativeTimeFormatter", () => {
  it("returns one shared instance per locale + options", () => {
    const a = dateTimeFormatter("en-GB", { month: "short" });
    expect(a).toBe(dateTimeFormatter("en-GB", { month: "short" }));
    expect(a).not.toBe(dateTimeFormatter("en-GB", { month: "long" }));
    expect(a).not.toBe(dateTimeFormatter("de-DE", { month: "short" }));
    expect(relativeTimeFormatter("en", { numeric: "auto" })).toBe(relativeTimeFormatter("en", { numeric: "auto" }));
  });

  it("formats with the locale and options it was given", () => {
    const march = Date.UTC(2026, 2, 15, 12);
    expect(dateTimeFormatter("en-US", { month: "long", timeZone: "UTC" }).format(march)).toBe("March");
    expect(dateTimeFormatter("de-DE", { month: "long", timeZone: "UTC" }).format(march)).toBe("März");
    expect(relativeTimeFormatter("en", { numeric: "auto" }).format(-1, "day")).toBe("yesterday");
  });

  it("falls back to the runtime default for a malformed locale instead of throwing", () => {
    expect(() => new Intl.DateTimeFormat("not a locale!")).toThrow(RangeError);
    const f = dateTimeFormatter("not a locale!", { year: "numeric", timeZone: "UTC" });
    expect(f.format(Date.UTC(2026, 0, 1))).toMatch(/2026/);
    expect(relativeTimeFormatter(["not a locale!"]).format(2, "day")).toMatch(/2/);
  });

  it("still throws for bad options: a fallback locale cannot fix those", () => {
    expect(() => dateTimeFormatter("en-US", { timeZone: "Not/AZone" })).toThrow(RangeError);
  });
});
