import { describe, expect, it } from "vitest";

import type { FilterDefinition, FilterValues } from "./filter-model";
import { filtersToSearchParams, searchParamsToFilters } from "./filter-url";

const OPTIONS = [
  { value: "eu-west", label: "EU West" },
  { value: "us-east", label: "US East" },
  { value: "ap-south", label: "AP South" },
];

const FILTERS: FilterDefinition[] = [
  { id: "region", label: "Region", kind: "multi", options: OPTIONS },
  { id: "tags", label: "Tags", kind: "multi", options: [], creatable: true },
  { id: "team", label: "Team", kind: "select", options: [{ value: "payments", label: "Payments" }] },
  { id: "status", label: "Status", kind: "toggle", options: [{ value: "up", label: "Up" }, { value: "down", label: "Down" }] },
  { id: "view", label: "View", kind: "toggle", exclusive: true, options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }] },
  { id: "p95", label: "p95", kind: "range", min: 0, max: 2000, step: 50 },
  { id: "day", label: "Day", kind: "dateRange" },
  { id: "time", label: "Time", kind: "dateRange", withTime: true },
  { id: "q", label: "Search", kind: "search" },
];

const NOW = new Date(2026, 9, 16, 14, 30);

describe("filtersToSearchParams", () => {
  it("writes each kind in its shape, one name per filter id, lists as repeated names", () => {
    const values: FilterValues = {
      region: ["eu-west", "us-east"],
      team: "payments",
      status: ["down"],
      p95: [300, 2000],
      day: { start: new Date(2026, 9, 1), end: new Date(2026, 9, 7) },
      q: "check out",
    };
    const params = filtersToSearchParams(values, FILTERS);
    expect(params.getAll("region")).toEqual(["eu-west", "us-east"]);
    expect(params.get("team")).toBe("payments");
    expect(params.getAll("status")).toEqual(["down"]);
    expect(params.get("p95")).toBe("300..");
    expect(params.get("day")).toBe("2026-10-01/2026-10-07");
    expect(params.get("q")).toBe("check out");
    expect(params.toString()).toBe(
      "region=eu-west&region=us-east&team=payments&status=down&p95=300..&day=2026-10-01%2F2026-10-07&q=check+out",
    );
  });

  it("leaves out an end at the scale's bound, and the whole range when both are", () => {
    const at = (p95: [number, number]) => filtersToSearchParams({ p95 }, FILTERS).get("p95");
    expect(at([0, 800])).toBe("..800");
    expect(at([300, 800])).toBe("300..800");
    expect(at([0, 2000])).toBeNull();
  });

  it("writes a preset as its id, and a timed range as local date-times with their offset", () => {
    const preset = filtersToSearchParams({ time: { start: NOW, end: NOW, preset: "last-7-days" } }, FILTERS);
    expect(preset.get("time")).toBe("last-7-days");
    const start = new Date(2026, 9, 15, 9, 0);
    const end = new Date(2026, 9, 15, 17, 30);
    const timed = filtersToSearchParams({ time: { start, end } }, FILTERS).get("time") ?? "";
    expect(timed).toMatch(/^2026-10-15T09:00[+-]\d{2}:\d{2}\/2026-10-15T17:30[+-]\d{2}:\d{2}$/);
  });

  it("keeps the base's other parameters and replaces the filters' own, so a removed filter leaves the URL", () => {
    const params = filtersToSearchParams({ q: "auth" }, FILTERS, { base: "tab=errors&region=eu-west&q=old" });
    expect(params.get("tab")).toBe("errors");
    expect(params.has("region")).toBe(false);
    expect(params.getAll("q")).toEqual(["auth"]);
  });

  it("prefixes every name and writes nothing for a filter that applies nothing", () => {
    const params = filtersToSearchParams({ region: [], q: "   ", team: "payments" }, FILTERS, { prefix: "f." });
    expect([...params.keys()]).toEqual(["f.team"]);
  });
});

describe("searchParamsToFilters", () => {
  it("reads back what it wrote, for every kind", () => {
    const values: FilterValues = {
      region: ["eu-west", "ap-south"],
      tags: ["p1", "on call"],
      team: "payments",
      status: ["up", "down"],
      view: ["grid"],
      p95: [100, 900],
      day: { start: new Date(2026, 9, 1), end: new Date(2026, 9, 7) },
      time: { start: new Date(2026, 9, 15, 9, 0), end: new Date(2026, 9, 15, 17, 30) },
      q: "checkout",
    };
    const back = searchParamsToFilters(filtersToSearchParams(values, FILTERS, { prefix: "f." }), FILTERS, { prefix: "f." });
    expect(back).toEqual(values);
  });

  it("resolves a preset against `now` and keeps its id", () => {
    const back = searchParamsToFilters("time=last-24-hours", FILTERS, { now: NOW });
    expect(back.time).toEqual({ start: new Date(NOW.getTime() - 86_400_000), end: NOW, preset: "last-24-hours" });
  });

  it("drops what does not read as its filter's value", () => {
    const back = searchParamsToFilters(
      "region=mars&region=eu-west&team=nobody&p95=abc..&day=2026-10-07/2026-10-01&time=next-week&view=grid&view=list&other=1",
      FILTERS,
    );
    expect(back).toEqual({ region: ["eu-west"], view: ["grid"] });
  });

  it("keeps any value of a creatable list, once each", () => {
    expect(searchParamsToFilters("tags=a&tags=b&tags=a", FILTERS)).toEqual({ tags: ["a", "b"] });
  });

  it("clamps a range to the scale and drops one that covers it all", () => {
    expect(searchParamsToFilters("p95=..9000", FILTERS)).toEqual({});
    expect(searchParamsToFilters("p95=-10..500", FILTERS)).toEqual({ p95: [0, 500] });
  });

  it("puts a custom filter in and out of the URL only through its own functions", () => {
    const custom: FilterDefinition[] = [
      {
        id: "owner",
        label: "Owner",
        kind: "custom",
        render: () => null,
        format: (v) => String(v),
        toParam: (v) => [String(v).toUpperCase()],
        fromParam: (raw) => raw[0]?.toLowerCase(),
      },
      { id: "plain", label: "Plain", kind: "custom", render: () => null, format: (v) => String(v) },
    ];
    const params = filtersToSearchParams({ owner: "ana", plain: "x" }, custom);
    expect(params.toString()).toBe("owner=ANA");
    expect(searchParamsToFilters("owner=BOB&plain=y", custom)).toEqual({ owner: "bob" });
  });
});
