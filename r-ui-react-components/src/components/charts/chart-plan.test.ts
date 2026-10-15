import { describe, expect, it } from "vitest";

import {
  cartesianNotes,
  cartesianTable,
  type ChartSeries,
  makeFormatters,
  MAX_DRAWN_SERIES,
  MAX_ROWS,
  MAX_TABLE_SERIES,
  modelCartesian,
  tidyLabel,
} from "./chart-model";
import {
  barPath,
  heatStep,
  MAX_HEAT_COLUMNS,
  MAX_HEAT_ROWS,
  markPath,
  modelHeatmap,
  nearestRow,
  planBars,
  planHeatAxis,
  planLine,
  type PlotBox,
} from "./chart-plan";
import { estimateMeasure } from "./chart-scale";

/**
 * The arithmetic half of the charts: everything a process with no layout engine
 * can judge. It cannot measure text (labels are spaced by an estimate here, by a
 * canvas in the browser), resolve a colour or paint, so overlap at real widths,
 * contrast and hit testing are `scripts/browser/charts-interaction.js`.
 */

const box: PlotBox = { width: 640, height: 216, fontSize: 12, measure: estimateMeasure(12) };
const fmt = makeFormatters({ locale: "en-US" });
const named = (...rows: (number | null)[][]): ChartSeries[] => rows.map((values, i) => ({ name: `s${i + 1}`, values }));

/** Every number a plan carries, including inside path strings, so one NaN cannot hide. */
function numbersIn(value: unknown, found: number[] = []): number[] {
  if (typeof value === "number") found.push(value);
  else if (typeof value === "string") {
    for (const m of value.matchAll(/-?(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|NaN|Infinity)/g)) found.push(Number(m[0]));
  } else if (Array.isArray(value)) for (const item of value) numbersIn(item, found);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) numbersIn(item, found);
  return found;
}
const allFinite = (plan: unknown) => numbersIn(plan).every(Number.isFinite);

describe("formatting", () => {
  it("formats values with Intl, units by identifier or as text, and a dash for a gap", () => {
    expect(makeFormatters({ locale: "en-US" }).value(1234.567)).toBe("1,234.57");
    expect(makeFormatters({ locale: "en-US", unit: "millisecond" }).value(120)).toBe("120 ms");
    expect(makeFormatters({ locale: "en-US", unit: "req/s" }).value(1200)).toBe("1,200 req/s");
    expect(fmt.value(null)).toBe("—");
    expect(fmt.tick(2500)).toBe("2.5K");
  });

  it("goes scientific where compact runs out, so a tick stays short", () => {
    expect(fmt.tick(1e308)).toBe("1E308");
    expect(fmt.value(-1e20)).toBe("-1E20");
  });

  it("survives a caller's formatter that throws or returns nonsense", () => {
    const f = makeFormatters({
      locale: "en-US",
      format: (v) => {
        if (v > 1) throw new Error("boom");
        return "" as string;
      },
    });
    expect([f.value(5), f.value(0.5)]).toEqual(["5", "0.5"]);
    expect(makeFormatters({ format: () => "x".repeat(20_000) }).value(1).length).toBeLessThanOrEqual(36);
  });

  it("cuts and collapses a hostile label", () => {
    expect(tidyLabel("  week\n one ")).toBe("week one");
    expect(tidyLabel("x".repeat(20_000))).toHaveLength(80);
    expect([tidyLabel(7), tidyLabel(null), tidyLabel({})]).toEqual(["", "", ""]);
  });
});

describe("modelCartesian", () => {
  it("infers the axis from x: dates are time, numbers a scale, anything else categories", () => {
    expect(modelCartesian({ x: [new Date(0), new Date(1)], series: named([1, 2]) }).xType).toBe("time");
    expect(modelCartesian({ x: [1, 2], series: named([1, 2]) }).xType).toBe("number");
    expect(modelCartesian({ x: ["a", 2], series: named([1, 2]) }).xType).toBe("category");
  });

  it("pads short series with gaps and counts values past the end of x", () => {
    const m = modelCartesian({ x: ["a", "b", "c"], series: named([1], [1, 2, 3, 4, 5]) });
    expect(m.rows.map((r) => r.values)).toEqual([
      [1, 1],
      [null, 2],
      [null, 3],
    ]);
    expect(cartesianNotes(m).valuesDropped).toBe(2);
  });

  it("turns NaN, Infinity, strings and objects into gaps, never zeros", () => {
    const m = modelCartesian({ series: [{ name: "s", values: [Number.NaN, Infinity, -Infinity, "4" as never, {} as never, 7] }] });
    expect(m.rows.map((r) => r.values[0])).toEqual([null, null, null, null, null, 7]);
  });

  it("names, numbers and de-duplicates series, __proto__ included", () => {
    const m = modelCartesian({
      series: [
        { name: "__proto__", values: [1] },
        { name: "__proto__", values: [2] },
        { name: 42 as never, values: [3] },
        null as never,
      ],
    });
    expect(m.series.map((s) => s.name)).toEqual(["__proto__", "__proto__ (2)", "Series 3", "Series 4"]);
    expect(cartesianTable(m, fmt, "").columns).toEqual(["__proto__", "__proto__ (2)", "Series 3", "Series 4"]);
  });

  it("sorts a time axis and puts rows it cannot place after the rest", () => {
    const m = modelCartesian({ x: [new Date(2000), new Date(Number.NaN), new Date(1000)], series: named([1, 2, 3]), timeZone: "UTC" });
    expect(m.rows.map((r) => r.index)).toEqual([2, 0, 1]);
    expect(m.rows[2]?.x).toBeNull();
    expect(m.xStep).toBe(1000);
  });

  it("draws eight series, never a ninth colour, and tabulates up to the table cap", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `n${i}`, values: [i] }));
    const m = modelCartesian({ series: many });
    expect(m.series.filter((s) => s.slot !== null)).toHaveLength(MAX_DRAWN_SERIES);
    expect(new Set(m.series.map((s) => s.slot).filter(Boolean)).size).toBe(MAX_DRAWN_SERIES);
    expect(new Set(m.series.map((s) => s.shape).filter(Boolean)).size).toBe(MAX_DRAWN_SERIES);
    expect(m.series).toHaveLength(MAX_TABLE_SERIES);
    expect(cartesianNotes(m)).toMatchObject({ seriesDrawn: 8, seriesTabulated: 24, seriesTotal: 30 });
  });

  it("keeps a pinned slot (colour and shape) with its entity, and fills the rest in order", () => {
    const m = modelCartesian({
      series: [
        { name: "eu-west", values: [1], slot: 2 },
        { name: "new", values: [1] },
        { name: "clash", values: [1], slot: 2 },
        { name: "bogus", values: [1], slot: 9 as never },
      ],
    });
    expect(m.series.map((s) => [s.name, s.slot, s.shape])).toEqual([
      ["eu-west", 2, "square"],
      ["new", 1, "circle"],
      ["clash", 3, "triangle"],
      ["bogus", 4, "diamond"],
    ]);
  });

  it("holds exactly MAX_ROWS rows and counts the one past it", () => {
    const at = modelCartesian({ series: [{ name: "s", values: Array.from({ length: MAX_ROWS }, (_, i) => i) }] });
    expect(at.rows).toHaveLength(MAX_ROWS);
    expect(at.dropped.rows).toBe(0);
    const over = modelCartesian({ series: [{ name: "s", values: Array.from({ length: MAX_ROWS + 1 }, (_, i) => i) }] });
    expect(over.rows).toHaveLength(MAX_ROWS);
    expect(cartesianNotes(over)).toMatchObject({ rowsShown: MAX_ROWS, rowsTotal: MAX_ROWS + 1 });
  });

  it("builds the table in every case, with series as columns and a dash for a gap", () => {
    const m = modelCartesian({ x: ["Mon", "Tue"], series: named([1, null], [3, 4]) });
    expect(cartesianTable(m, fmt, "Day")).toEqual({
      corner: "Day",
      columns: ["s1", "s2"],
      rows: [
        { label: "Mon", cells: ["1", "3"] },
        { label: "Tue", cells: ["—", "4"] },
      ],
    });
    expect(modelCartesian({ series: named([null, null]) }).drawable).toBe(false);
  });
});

describe("planLine", () => {
  const hostile: [string, Parameters<typeof modelCartesian>[0]][] = [
    ["no series", { series: [] }],
    ["series not an array", { series: "nope" as never }],
    ["one point", { series: named([5]) }],
    ["zero span", { series: named([3, 3, 3]) }],
    ["all zero", { series: named([0, 0]) }],
    ["all null", { series: named([null, null]) }],
    ["negatives", { series: named([-5, -1e3, 4]) }],
    ["1e308", { series: named([1e308, -1e308, 0]) }],
    ["MAX_VALUE", { series: named([Number.MAX_VALUE, -Number.MAX_VALUE]) }],
    ["mismatched", { x: ["a", "b", "c"], series: named([1], [1, 2, 3, 4]) }],
    ["one time point", { x: [new Date(0)], series: named([1]) }],
    ["same time twice", { x: [new Date(0), new Date(0)], series: named([1, 2]) }],
    ["number x with NaN", { x: [1, Number.NaN, 3], series: named([1, 2, 3]) }],
    ["20k label", { x: ["x".repeat(20_000), "y"], series: [{ name: "z".repeat(20_000), values: [1, 2] }] }],
  ];
  it.each(hostile)("never throws and never emits a non-finite number: %s", (_, input) => {
    const m = modelCartesian(input);
    const plan = planLine(m, box, { formatters: fmt });
    // A drawable input gets a drawing; only an undrawable one gets none.
    expect(plan === null).toBe(!m.drawable);
    expect(allFinite(plan)).toBe(true);
    expect(allFinite(planBars(m, box, { formatters: fmt, barThick: 16, radius: 4 }))).toBe(true);
    expect(allFinite(planBars(m, box, { formatters: fmt, barThick: 16, radius: 4, orientation: "horizontal", stacked: true }))).toBe(true);
  });

  it("declines to draw what has no value, and draws a lone point as a marker", () => {
    expect(planLine(modelCartesian({ series: named([null]) }), box, { formatters: fmt })).toBeNull();
    const one = planLine(modelCartesian({ series: named([5]) }), box, { formatters: fmt });
    expect(one?.series[0]?.path).toBeNull();
    expect(one?.series[0]?.markers).toHaveLength(1);
  });

  it("breaks the line at a gap instead of bridging it", () => {
    const plan = planLine(modelCartesian({ series: named([1, 2, null, 4, 5]) }), box, { formatters: fmt });
    expect(plan?.series[0]?.path?.match(/M/g)).toHaveLength(2);
  });

  it("starts the value axis at zero unless min is pinned, and draws a zero line through negatives", () => {
    const up = planLine(modelCartesian({ series: named([40, 50]) }), box, { formatters: fmt });
    expect(up?.yTicks[0]?.label).toBe("0");
    const pinned = planLine(modelCartesian({ series: named([40, 50]) }), box, { formatters: fmt, min: 40 });
    expect(pinned?.yTicks[0]?.label).toBe("40");
    const signed = planLine(modelCartesian({ series: named([-10, 10]) }), box, { formatters: fmt });
    expect(signed?.zeroY).not.toBeNull();
  });

  it("thins x labels so none overlaps, at a phone's width and a desktop's", () => {
    const x = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 6, 17 + i)));
    const m = modelCartesian({ x, series: named(x.map((_, i) => i)), timeZone: "UTC", locale: "en-US" });
    for (const width of [320, 1200]) {
      const plan = planLine(m, { ...box, width }, { formatters: fmt });
      const labels = plan?.xLabels ?? [];
      expect(labels.length).toBeGreaterThanOrEqual(2);
      const gaps = labels.slice(1).map((l, i) => l.center - l.width / 2 - ((labels[i]?.center ?? 0) + (labels[i]?.width ?? 0) / 2));
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(box.fontSize);
      for (const l of labels) {
        expect(l.center - l.width / 2).toBeGreaterThanOrEqual(0);
        expect(l.center + l.width / 2).toBeLessThanOrEqual(width);
      }
    }
  });

  it("puts markers on every point only when there is room for them", () => {
    const few = planLine(modelCartesian({ series: named([1, 2, 3, 4]) }), box, { formatters: fmt });
    expect(few?.series[0]?.markers).toHaveLength(4);
    const many = planLine(modelCartesian({ series: named(Array.from({ length: 400 }, (_, i) => i % 7)) }), box, { formatters: fmt });
    expect(many?.series[0]?.markers).toHaveLength(1);
  });

  it("snaps a pointer to the nearest placed row", () => {
    const pos = [0, 10, null, 30];
    const order = [0, 1, 3];
    expect([nearestRow(pos, order, -5), nearestRow(pos, order, 14), nearestRow(pos, order, 21), nearestRow(pos, order, 99)]).toEqual([0, 1, 3, 3]);
    expect(nearestRow(pos, [], 5)).toBeNull();
  });
});

describe("planBars", () => {
  const m = modelCartesian({ x: ["5xx", "4xx", "Timeouts"], series: named([30, 120, 8], [10, -20, 4]) });

  it("takes --BAR-THICK as the thickness and shrinks it only when a band cannot hold it", () => {
    const roomy = planBars(m, box, { formatters: fmt, barThick: 16, radius: 4 });
    expect(roomy?.bars).toHaveLength(6);
    expect(new Set(roomy?.bars.map((b) => b.w))).toEqual(new Set([16]));
    const tight = planBars(modelCartesian({ series: named(Array.from({ length: 300 }, () => 1)) }), box, {
      formatters: fmt,
      barThick: 16,
      radius: 4,
    });
    const thin = tight?.bars.map((b) => b.w) ?? [];
    expect(thin).toHaveLength(300);
    expect(Math.max(...thin)).toBeLessThan(16);
    expect(Math.min(...thin)).toBeGreaterThan(0);
  });

  it("grows a horizontal chart with its categories and labels the value at the tip", () => {
    const h = planBars(m, box, { formatters: fmt, barThick: 16, radius: 4, orientation: "horizontal" });
    expect(h?.height).toBeGreaterThan(3 * (2 * 16));
    expect(h?.values.map((v) => v.text)).toEqual(["30", "10", "120", "-20", "8", "4"]);
    expect(h?.categoryLabels.map((l) => l.text)).toEqual(["5xx", "4xx", "Timeouts"]);
  });

  it("stacks positives up and negatives down from one baseline", () => {
    const s = planBars(m, box, { formatters: fmt, barThick: 16, radius: 4, stacked: true });
    expect(s?.bars).toHaveLength(6);
    expect(s?.valueTicks.some((t) => t.label.startsWith("-"))).toBe(true);
  });

  it("rounds only the data end, within half the thickness", () => {
    expect(barPath(0, 0, 10, 50, 4, "top")).toContain("Q");
    expect(barPath(0, 0, 10, 50, 4, "none")).not.toContain("Q");
    expect(barPath(0, 0, 2, 50, 4, "top")).toContain("Q0 0 1 0");
  });

  it("labels a time band axis on calendar boundaries", () => {
    const x = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(2026, 9, 8, i * 4)));
    const t = modelCartesian({ x, series: named(x.map(() => 1)), timeZone: "UTC", locale: "en-US" });
    const plan = planBars(t, box, { formatters: fmt, barThick: 16, radius: 4 });
    expect(plan?.categoryLabels.length).toBeGreaterThanOrEqual(3);
    // The labels are times on 12-hour (or coarser) boundaries, never every band.
    expect(plan?.categoryLabels.length).toBeLessThan(42);
  });
});

describe("marks", () => {
  it("gives every one of the eight series its own glyph", () => {
    const shapes = modelCartesian({ series: Array.from({ length: 8 }, (_, i) => ({ name: `${i}`, values: [i] })) }).series.map((s) => s.shape);
    expect(new Set(shapes.map((s) => markPath(s ?? "circle", 10, 10, 4))).size).toBe(8);
  });
});

describe("heatmap", () => {
  it("bins into seven steps, greatest magnitude at step 1, and a zero span at the faintest", () => {
    expect([0, 14, 15, 50, 99, 100].map((v) => heatStep(v, 0, 100))).toEqual([7, 7, 6, 4, 1, 1]);
    expect(heatStep(5, 5, 5)).toBe(7);
    expect(heatStep(1e308, -1e308, 1e308)).toBe(1);
  });

  it("models ragged, hostile input and caps rows and columns at exactly their limits", () => {
    const m = modelHeatmap({ rows: ["Mon"], columns: [], values: [[1, Number.NaN, "x"], null as never, [3]] });
    expect(m.rows).toEqual(["Mon", "2", "3"]);
    expect(m.columns).toEqual(["1", "2", "3"]);
    expect(m.cells[0]?.map((c) => c.value)).toEqual([1, null, null]);
    const at = modelHeatmap({ values: Array.from({ length: MAX_HEAT_ROWS }, () => Array.from({ length: MAX_HEAT_COLUMNS }, () => 1)) });
    expect([at.rows.length, at.columns.length, at.dropped.rows, at.dropped.columns]).toEqual([MAX_HEAT_ROWS, MAX_HEAT_COLUMNS, 0, 0]);
    const over = modelHeatmap({ values: Array.from({ length: MAX_HEAT_ROWS + 1 }, () => Array.from({ length: MAX_HEAT_COLUMNS + 1 }, () => 1)) });
    expect([over.rows.length, over.columns.length, over.dropped.rows, over.dropped.columns]).toEqual([MAX_HEAT_ROWS, MAX_HEAT_COLUMNS, 1, 1]);
  });

  it("is undrawable when every value is missing", () => {
    expect(modelHeatmap({ rows: ["a"], columns: ["b"], values: [[null]] }).drawable).toBe(false);
  });

  it("thins hour labels from midnight to what the width holds", () => {
    const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
    const m = modelHeatmap({ rows: ["Mon"], columns: hours, values: [hours.map(() => 1)] });
    const phone = planHeatAxis(m, 340, 12, estimateMeasure(12));
    expect(phone.columnLabels[0]?.text).toBe("00:00");
    expect(phone.columnLabels.length).toBeLessThan(12);
    const wide = planHeatAxis(m, 1200, 12, estimateMeasure(12));
    expect(wide.columnLabels.length).toBeGreaterThan(phone.columnLabels.length);
  });
});
