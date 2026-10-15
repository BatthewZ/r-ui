import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatCompact,
  formatDelta,
  formatNumber,
  formatPercent,
  formatUnit,
  isPresent,
  MISSING,
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
});
