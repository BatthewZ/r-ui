import { describe, expect, it } from "vitest";

import { DEFAULT_FILTER_BAR_LABELS } from "./FilterBar";
import {
  appliedFilters,
  clearFilterValues,
  type FilterDefinition,
  filterChipText,
  normalizeFilterValue,
  type SelectFilterDefinition,
  setFilterValue,
} from "./filter-model";

const region: FilterDefinition = {
  id: "region",
  label: "Region",
  kind: "multi",
  options: [
    { value: "eu", label: "EU" },
    { value: "us", label: "US" },
  ],
};
const p95: FilterDefinition = {
  id: "p95",
  label: "p95",
  kind: "range",
  min: 0,
  max: 2000,
  formatOptions: { style: "unit", unit: "millisecond" },
};
const time: FilterDefinition = { id: "time", label: "Time", kind: "dateRange" };
const q: FilterDefinition = { id: "q", label: "Search", kind: "search" };
const team: SelectFilterDefinition = { id: "team", label: "Team", kind: "select", options: [{ value: "pay", label: "Payments" }] };

const chip = (def: FilterDefinition, value: unknown) =>
  filterChipText(def, normalizeFilterValue(def, value), DEFAULT_FILTER_BAR_LABELS, "en-US");

describe("filter chips", () => {
  it("summarise each kind in words", () => {
    expect(chip(region, ["eu", "us"])).toBe("Region: EU, US");
    expect(chip(team, "pay")).toBe("Team: Payments");
    expect(chip(q, "  checkout ")).toBe("Search: “checkout”");
    expect(chip(p95, [300, 2000])).toBe("p95 ≥ 300 ms");
    expect(chip(p95, [0, 800])).toBe("p95 ≤ 800 ms");
    expect(chip(p95, [300, 800])).toBe("p95 300–800 ms");
    expect(chip(time, { start: new Date(), end: new Date(), preset: "last-7-days" })).toBe("Last 7 days");
    expect(chip(time, { start: new Date(2026, 9, 1), end: new Date(2026, 9, 7) })).toMatch(/^Time: Oct 1\s–\s7, 2026$/);
  });

  it("list choices in the options' order, a value no option names as itself and last, and a filter's own format over the default", () => {
    expect(chip(region, ["mars", "us", "eu"])).toBe("Region: EU, US, mars");
    expect(chip({ ...team, format: (v: string) => `Owned by ${v}` }, "pay")).toBe("Owned by pay");
  });
});

describe("filter values", () => {
  it("drop a filter's key when its value applies nothing, and keep the object when nothing changes", () => {
    const values = { region: ["eu"], q: "x" };
    expect(setFilterValue(values, region, [])).toEqual({ q: "x" });
    expect(setFilterValue(values, q, "  ")).toEqual({ region: ["eu"] });
    expect(setFilterValue(values, p95, [0, 2000])).toBe(values);
    expect(setFilterValue(values, p95, [2500, 100])).toEqual({ ...values, p95: [100, 2000] });
  });

  it("clear only the filters given, keeping other keys", () => {
    const values = { region: ["eu"], q: "x", name: "column filter" };
    expect(clearFilterValues(values, [region, q])).toEqual({ name: "column filter" });
    expect(clearFilterValues({ name: "a" }, [region])).toEqual({ name: "a" });
  });

  it("list the applied filters in definition order", () => {
    expect(appliedFilters([region, p95, q], { q: "x", region: ["eu"], p95: [0, 2000] }).map((f) => f.id)).toEqual(["region", "q"]);
  });
});
