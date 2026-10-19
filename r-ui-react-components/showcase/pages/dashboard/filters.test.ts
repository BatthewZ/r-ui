import { describe, expect, it } from "vitest";

import type { DateRange } from "../../../src/components/dates";
import { DAY_MS, generate, NOW, type Service } from "./data";
import { DEFAULT_FILTERS, fromAnchor, matchService, toAnchor, viewOf } from "./filters";

const service = (over: Partial<Service>): Service => ({
  name: "checkout",
  owner: "Payments",
  status: "critical",
  rps: 300,
  p95: 1200,
  errors: 0.03,
  cpu: 70,
  deployedMin: 95,
  ...over,
});

describe("the Dashboard's view in its hash anchor", () => {
  it("writes the default view as the empty anchor, and reads the empty anchor as the default view", () => {
    expect((DEFAULT_FILTERS.time as DateRange<Date>).preset).toBe("last-7-days");
    expect(toAnchor(DEFAULT_FILTERS, "production")).toBe("");
    expect(fromAnchor("")).toEqual({ values: DEFAULT_FILTERS, env: "production" });
    expect(fromAnchor(null).env).toBe("production");
  });

  it("round-trips every filter and the environment", () => {
    const values = {
      time: { start: new Date(NOW - DAY_MS), end: new Date(NOW), preset: "last-24-hours" },
      region: ["eu-west", "us-east"],
      status: ["critical", "serious"],
      p95: [300, 2000],
      q: "pay",
    };
    const anchor = toAnchor(values, "staging");
    expect(anchor).toBe("env=staging&time=last-24-hours&region=eu-west&region=us-east&status=critical&status=serious&p95=300..&q=pay");
    const read = fromAnchor(anchor);
    expect(read.env).toBe("staging");
    expect(read.values).toEqual(values);
  });

  it("keeps a custom range with times to the minute", () => {
    const time = { start: new Date(2026, 9, 10, 9, 30), end: new Date(2026, 9, 12, 18, 0) };
    const read = fromAnchor(toAnchor({ time }, "production")).values.time as DateRange<Date>;
    expect(read.start.getTime()).toBe(time.start.getTime());
    expect(read.end.getTime()).toBe(time.end.getTime());
    expect(read.preset).toBeUndefined();
  });

  it("writes no time filter as an empty time=, which reads back as no time filter (not the default)", () => {
    expect(toAnchor({}, "production")).toBe("time=");
    expect(fromAnchor("time=").values).toEqual({});
    expect(fromAnchor("region=eu-west").values).toEqual({ ...DEFAULT_FILTERS, region: ["eu-west"] });
  });

  it("drops what does not read as a filter's value", () => {
    expect(fromAnchor("status=bogus&p95=abc&region=mars&time=2026-10-12/2026-10-01&env=moon")).toEqual({ values: {}, env: "production" });
  });
});

describe("viewOf", () => {
  it("names a preset by its label and compares with the prior window of the same length", () => {
    const view = viewOf(DEFAULT_FILTERS);
    expect(view.window).toEqual({ start: NOW - 7 * DAY_MS, end: NOW });
    expect(view).toMatchObject({ span: "Last 7 days", phrase: "last 7 days", prior: "vs prior 7d", step: "4-hour intervals" });
    expect(view.regions).toEqual([]);
  });

  it("is every retained day without a time filter", () => {
    expect(viewOf({})).toMatchObject({ window: { start: NOW - 90 * DAY_MS, end: NOW }, span: "Last 90 days", step: "daily" });
  });

  it("writes a custom range as its own dates, in sentences as written", () => {
    const view = viewOf({ time: { start: new Date(2026, 9, 10, 9, 30), end: new Date(2026, 9, 12, 18, 0) }, region: ["sa-east"] });
    expect(view.span).toMatch(/Oct 10.*9:30.*Oct 12.*6:00/);
    expect(view.phrase).toBe(view.span);
    expect(view.prior).toBe("vs prior 2d");
    expect(view.regions).toEqual(["sa-east"]);
  });
});

describe("generate", () => {
  it("shapes the series by the window and keeps one series per region asked for", () => {
    const day = generate({ start: NOW - DAY_MS, end: NOW }, ["eu-west"], "production");
    expect(day.times).toHaveLength(24);
    expect(day.times.at(-1)).toBe(NOW);
    expect(day.traffic.map((s) => s.name)).toEqual(["eu-west"]);
    const all = generate({ start: NOW - 30 * DAY_MS, end: NOW }, [], "production");
    expect(all.times).toHaveLength(30);
    expect(all.traffic).toHaveLength(4);
  });
});

describe("matchService", () => {
  it("applies status, latency (a service with no data fails a latency filter) and search over names and teams", () => {
    expect(matchService(service({}), { status: ["critical"] })).toBe(true);
    expect(matchService(service({}), { status: ["good"] })).toBe(false);
    expect(matchService(service({}), { p95: [0, 1000] })).toBe(false);
    expect(matchService(service({ p95: null }), { p95: [0, 2000] })).toBe(false);
    expect(matchService(service({}), { q: "  PAYM " })).toBe(true);
    expect(matchService(service({}), { q: "search" })).toBe(false);
    expect(matchService(service({}), {})).toBe(true);
  });
});
