import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DOMAIN_COLORS, domainColor, seriesColor } from "./domain-color";

// Read from disk: vitest runs without CSS processing, so a `?raw` import is empty.
const tokensCss = readFileSync(join(import.meta.dirname, "..", "tokens.css"), "utf8");

describe("domainColor", () => {
  it("names exactly the LIGHT/DARK pairs declared in tokens.css", () => {
    const pairs = new Set(
      [...tokensCss.matchAll(/^\s*--C-([A-Z0-9-]+)-LIGHT:/gm)].map((m) => m[1]),
    );
    expect(new Set(DOMAIN_COLORS)).toEqual(pairs);
  });

  it("is the same blend tokens.css writes in its @theme values", () => {
    expect(tokensCss).toContain(`--color-series-3: ${domainColor("SERIES-3")};`);
    expect(tokensCss).toContain(`--color-chart-grid: ${domainColor("CHART-GRID")};`);
  });

  it("maps a 1-based slot to its series and refuses a ninth", () => {
    expect(seriesColor(1)).toBe(domainColor("SERIES-1"));
    expect(() => seriesColor(9)).toThrow(RangeError);
    expect(() => seriesColor(0)).toThrow(RangeError);
  });
});
