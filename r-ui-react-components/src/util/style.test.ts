import { describe, expect, it } from "vitest";

import { cn } from "./style";

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("drops undefined, null, false and empty values", () => {
    const isActive = false;
    expect(cn("foo", undefined, null, isActive && "active", "", "bar")).toBe("foo bar");
  });

  it("returns an empty string when nothing valid is passed", () => {
    expect(cn(undefined, null, false, "")).toBe("");
  });

  it("resolves conflicting domain colour utilities last-wins", () => {
    expect(cn("bg-series-1", "bg-series-4")).toBe("bg-series-4");
    expect(cn("stroke-seq-1 stroke-chart-grid")).toBe("stroke-chart-grid");
    expect(cn("text-trend-good", "text-trend-bad")).toBe("text-trend-bad");
  });

  it("resolves conflicting domain size utilities last-wins", () => {
    expect(cn("h-chart", "h-bar")).toBe("h-bar");
    expect(cn("size-heat-cell", "size-full")).toBe("size-full");
  });

  it("knows text-kpi is a font SIZE, so it does not swallow a text colour", () => {
    // Without the `text` mirror, tailwind-merge cannot tell `text-kpi` from a
    // colour and drops one of these two.
    expect(cn("text-kpi", "text-trend-good")).toBe("text-kpi text-trend-good");
  });

  it("keeps non-conflicting utilities", () => {
    expect(cn("bg-series-1", "text-trend-flat", "h-chart")).toBe("bg-series-1 text-trend-flat h-chart");
  });
});
