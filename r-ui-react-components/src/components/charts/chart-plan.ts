/**
 * Geometry: a normalised model plus a measured box in, everything a renderer
 * draws out. Pure, so every number here is checked in a process with no layout
 * engine; the renderers only map it to SVG and wire the pointer and keys.
 *
 * Every plan is in real pixels for the box it was given (the renderers redraw on
 * resize), so strokes, text and hit targets are never stretched.
 */
import { isPresent } from "../../util/format";
import {
  type CartesianModel,
  type DrawnSeries,
  drawnSeries,
  type Formatters,
  MAX_AXIS_CHARS,
  type ModelRow,
  type SeriesShape,
  type SeriesSlot,
  tidyLabel,
} from "./chart-model";
import {
  type AxisLabel,
  bandTimeLabels,
  clamp,
  fitLabels,
  linearScale,
  type Measure,
  type NiceScale,
  niceTicks,
  round2,
  safeSpan,
  thinLabels,
  timeAxis,
} from "./chart-scale";

/** The box a chart is drawn into, measured by the renderer. */
export interface PlotBox {
  width: number;
  height: number;
  /** The axis text's font size (px). */
  fontSize: number;
  measure: Measure;
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ValueTick {
  /** Pixel position along the value axis. */
  pos: number;
  label: string;
}

/** Below this the box cannot hold a plot worth reading. */
const MIN_PLOT = 24;

/* ------------------------------------------------------------------ */
/*  Marks                                                              */
/* ------------------------------------------------------------------ */

/** A series' marker glyph centred on (x, y), radius r. Closed shapes fill; plus and cross stroke. */
export function markPath(shape: SeriesShape, x: number, y: number, r: number): string {
  const p = round2;
  switch (shape) {
    case "square":
      return `M${p(x - r * 0.9)} ${p(y - r * 0.9)}h${p(r * 1.8)}v${p(r * 1.8)}h${p(-r * 1.8)}Z`;
    case "triangle":
      return `M${p(x)} ${p(y - r * 1.15)}L${p(x + r * 1.1)} ${p(y + r * 0.85)}L${p(x - r * 1.1)} ${p(y + r * 0.85)}Z`;
    case "triangle-down":
      return `M${p(x)} ${p(y + r * 1.15)}L${p(x + r * 1.1)} ${p(y - r * 0.85)}L${p(x - r * 1.1)} ${p(y - r * 0.85)}Z`;
    case "diamond":
      return `M${p(x)} ${p(y - r * 1.25)}L${p(x + r * 1.25)} ${p(y)}L${p(x)} ${p(y + r * 1.25)}L${p(x - r * 1.25)} ${p(y)}Z`;
    case "plus":
      return `M${p(x - r * 1.2)} ${p(y)}h${p(r * 2.4)}M${p(x)} ${p(y - r * 1.2)}v${p(r * 2.4)}`;
    case "cross":
      return `M${p(x - r)} ${p(y - r)}l${p(r * 2)} ${p(r * 2)}M${p(x + r)} ${p(y - r)}l${p(-r * 2)} ${p(r * 2)}`;
    case "star": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.3 : r * 0.55;
        pts.push(`${p(x + Math.cos(a) * rr)} ${p(y + Math.sin(a) * rr)}`);
      }
      return `M${pts.join("L")}Z`;
    }
    case "circle":
    default:
      return `M${p(x - r)} ${p(y)}a${p(r)} ${p(r)} 0 1 0 ${p(r * 2)} 0a${p(r)} ${p(r)} 0 1 0 ${p(-r * 2)} 0`;
  }
}

/** Shapes drawn as strokes: they enclose no area, so a fill alone paints nothing. */
export const STROKED_SHAPES: ReadonlySet<SeriesShape> = new Set(["plus", "cross"]);

/**
 * A bar with a rounded data end and a square base. `end` is the side the value
 * grows toward; the radius never exceeds half the thickness or the length.
 */
export function barPath(x: number, y: number, w: number, h: number, radius: number, end: "top" | "bottom" | "left" | "right" | "none"): string {
  const p = round2;
  const thick = end === "left" || end === "right" ? h : w;
  const length = end === "left" || end === "right" ? w : h;
  const r = end === "none" ? 0 : Math.max(0, Math.min(radius, thick / 2, length));
  if (r === 0) return `M${p(x)} ${p(y)}h${p(w)}v${p(h)}h${p(-w)}Z`;
  switch (end) {
    case "top":
      return `M${p(x)} ${p(y + h)}V${p(y + r)}Q${p(x)} ${p(y)} ${p(x + r)} ${p(y)}H${p(x + w - r)}Q${p(x + w)} ${p(y)} ${p(x + w)} ${p(y + r)}V${p(y + h)}Z`;
    case "bottom":
      return `M${p(x)} ${p(y)}V${p(y + h - r)}Q${p(x)} ${p(y + h)} ${p(x + r)} ${p(y + h)}H${p(x + w - r)}Q${p(x + w)} ${p(y + h)} ${p(x + w)} ${p(y + h - r)}V${p(y)}Z`;
    case "right":
      return `M${p(x)} ${p(y)}H${p(x + w - r)}Q${p(x + w)} ${p(y)} ${p(x + w)} ${p(y + r)}V${p(y + h - r)}Q${p(x + w)} ${p(y + h)} ${p(x + w - r)} ${p(y + h)}H${p(x)}Z`;
    case "left":
    default:
      return `M${p(x + w)} ${p(y)}H${p(x + r)}Q${p(x)} ${p(y)} ${p(x)} ${p(y + r)}V${p(y + h - r)}Q${p(x)} ${p(y + h)} ${p(x + r)} ${p(y + h)}H${p(x + w)}Z`;
  }
}

/** `text` cut (with an ellipsis) until it measures within `max`. */
export function fitText(text: string, max: number, measure: Measure): string {
  if (measure(text) <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid)}…`) <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "…" : `${text.slice(0, lo)}…`;
}

/* ------------------------------------------------------------------ */
/*  Shared value axis                                                  */
/* ------------------------------------------------------------------ */

interface Domain {
  low: number;
  high: number;
}

function dataDomain(values: Iterable<number>, includeZero: boolean): Domain | null {
  let low = includeZero ? 0 : Infinity;
  let high = includeZero ? 0 : -Infinity;
  let any = false;
  for (const v of values) {
    any = true;
    if (v < low) low = v;
    if (v > high) high = v;
  }
  return any ? { low, high } : null;
}

function valueScale(domain: Domain, length: number, fontSize: number, min: number | undefined, max: number | undefined, count?: number) {
  const pinLo = isPresent(min);
  const pinHi = isPresent(max);
  const low = pinLo ? min : domain.low;
  const high = pinHi ? max : domain.high;
  // A zero span (every value 0, or every value equal with no zero in view) still
  // gets an axis: widen it by one around the value.
  const [lo0, hi0] = low === high && !pinLo && !pinHi ? (low === 0 ? [0, 1] : [Math.min(0, low), Math.max(0, high)]) : [low, high];
  return niceTicks(lo0, hi0, count ?? Math.max(2, Math.floor(length / (fontSize * 2.6)) + 1), pinLo, pinHi);
}

/* ------------------------------------------------------------------ */
/*  Line / area                                                        */
/* ------------------------------------------------------------------ */

export interface LineSeriesPlan {
  /** Index into the model's series. */
  series: number;
  slot: SeriesSlot;
  shape: SeriesShape;
  /** Runs of adjacent points; a gap breaks the line. `null` when no run has two points. */
  path: string | null;
  /** The area under each run, down to the baseline. */
  area: string | null;
  /** Points that carry a marker: all of them when they are sparse, else the ends of runs. */
  markers: { row: number; x: number; y: number }[];
}

export interface LinePlan {
  width: number;
  height: number;
  plot: Rect;
  yTicks: ValueTick[];
  /** Where zero sits, when it is inside the plot and not its floor. */
  zeroY: number | null;
  xLabels: AxisLabel[];
  /** Pixel x per model row; `null` for a row that cannot be placed. */
  rowX: (number | null)[];
  /** Pixel y per [model series][model row]; `null` for a gap or an undrawn series. */
  rowY: (number | null)[][];
  /** Placeable rows in order of x: what the crosshair steps through. */
  order: number[];
  series: LineSeriesPlan[];
  markerRadius: number;
}

export interface LinePlanOptions {
  area?: boolean;
  min?: number;
  max?: number;
  formatters: Formatters;
}

/** The plot's frame for a vertical value axis: gutter from the widest tick label. */
function verticalFrame(box: PlotBox, ticks: { label: string }[]) {
  const { width, height, fontSize, measure } = box;
  const widest = ticks.reduce((most, t) => Math.max(most, measure(t.label)), 0);
  const left = Math.min(round2(widest + fontSize * 0.6), width * 0.45);
  return {
    left,
    right: round2(width - fontSize * 0.5),
    top: round2(fontSize * 0.7),
    bottom: round2(height - fontSize * 1.9),
  };
}

/** A row that can be placed on the x axis, with its position in `model.rows`. */
interface PlacedRow {
  r: ModelRow;
  i: number;
}

function placedRows(model: CartesianModel): PlacedRow[] {
  return model.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.x !== null);
}

interface LinePoint {
  row: number;
  x: number;
  y: number;
}

/** Runs of adjacent points in `order`; a row with no x or no y ends a run. */
function pointRuns(order: readonly number[], rowX: readonly (number | null)[], ys: readonly (number | null)[]): LinePoint[][] {
  const runs: LinePoint[][] = [];
  let run: LinePoint[] = [];
  for (const i of order) {
    const x = rowX[i];
    const y = ys[i];
    if (x === null || x === undefined || y === null || y === undefined) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ row: i, x, y });
  }
  if (run.length) runs.push(run);
  return runs;
}

const runPath = (run: readonly LinePoint[]): string => run.map((p, k) => `${k ? "L" : "M"}${p.x} ${p.y}`).join("");

/** The area under a run, closed along `baseline`. */
function runArea(run: readonly LinePoint[], baseline: number): string {
  const first = run[0] as LinePoint;
  const last = run[run.length - 1] as LinePoint;
  return `M${first.x} ${round2(baseline)}${run.map((p) => `L${p.x} ${p.y}`).join("")}L${last.x} ${round2(baseline)}Z`;
}

/** Calendar ticks on a time axis, the densest nice numbers that fit on a number axis, thinned rows on a category axis. */
function lineXLabels(
  model: CartesianModel,
  placed: readonly PlacedRow[],
  rowX: readonly (number | null)[],
  projectX: (x: number) => number,
  [xMin, xMax]: readonly [number, number],
  plotW: number,
  { width, fontSize, measure }: PlotBox,
): AxisLabel[] {
  const gap = fontSize;
  if (model.xType === "time") {
    const labels = timeAxis(xMin, xMax, projectX, measure, 0, width, gap, model.zone, model.locale).labels;
    if (labels.length > 0 || xMin !== xMax) return labels;
    return thinLabels([{ at: projectX(xMin), text: tidyLabel(model.rows[placed[0]?.i ?? 0]?.label, MAX_AXIS_CHARS) }], measure, 0, width, gap);
  }
  if (model.xType === "number") {
    for (let count = Math.max(2, Math.floor(plotW / (fontSize * 4))); count >= 2; count -= 1) {
      const ticks = niceTicks(xMin, xMax, count)
        .ticks.filter((t) => t >= xMin && t <= xMax)
        .map((t) => ({ at: projectX(t), text: model.formatX(t) }));
      const fit = fitLabels(ticks, measure, 0, width, gap);
      if (fit) return fit;
    }
    return [];
  }
  return thinLabels(
    placed.map(({ r, i }) => ({ at: rowX[i] ?? 0, text: r.axisLabel })),
    measure,
    0,
    width,
    gap,
  );
}

export function planLine(model: CartesianModel, box: PlotBox, options: LinePlanOptions): LinePlan | null {
  const { width, height, fontSize } = box;
  if (!model.drawable || !(width > MIN_PLOT * 2) || !(height > MIN_PLOT * 2)) return null;
  const drawn = drawnSeries(model.series);
  const placed = placedRows(model);
  const order = placed.map(({ i }) => i);

  function* values() {
    for (const { r } of placed) for (const s of drawn) {
      const v = r.values[s.index];
      if (v !== null && v !== undefined) yield v;
    }
  }
  const domain = dataDomain(values(), !isPresent(options.min));
  if (!domain) return null;

  // Two passes: the tick count depends on the plot height, the gutter on the tick labels.
  const roughHeight = height - fontSize * 2.6;
  const scale = valueScale(domain, roughHeight, fontSize, options.min, options.max);
  const yLabels = scale.ticks.map((v) => ({ value: v, label: options.formatters.tick(v) }));
  const plot = verticalFrame(box, yLabels);
  if (plot.right - plot.left < MIN_PLOT || plot.bottom - plot.top < MIN_PLOT) return null;
  const projectY = linearScale(scale.lo, scale.hi, plot.bottom, plot.top);
  const yTicks = yLabels.map((t) => ({ pos: round2(projectY(t.value) ?? plot.bottom), label: t.label }));

  // X positions.
  const xs = placed.map(({ r }) => r.x as number);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const plotW = plot.right - plot.left;
  const projectX =
    model.xType === "category"
      ? (x: number) => (model.rows.length > 1 ? plot.left + (plotW * x) / (model.rows.length - 1) : plot.left + plotW / 2)
      : (x: number) => linearScale(xMin, xMax, plot.left, plot.right)(x) ?? plot.left;
  const rowX: (number | null)[] = model.rows.map((r) => (r.x === null ? null : round2(projectX(r.x))));
  const xLabels = lineXLabels(model, placed, rowX, projectX, [xMin, xMax], plotW, box);

  const zero = projectY(0);
  const zeroY = zero !== null && scale.lo < 0 && scale.hi > 0 ? round2(zero) : null;
  const baseline = zeroY ?? plot.bottom;

  const rowY: (number | null)[][] = model.series.map((s) =>
    model.rows.map((r) => {
      if (s.slot === null) return null;
      const y = projectY(r.values[s.index] ?? null);
      return y === null ? null : round2(y);
    }),
  );

  const sparse = placed.length <= plotW / (fontSize * 2.5);
  const series: LineSeriesPlan[] = drawn.map((s) => {
    const runs = pointRuns(order, rowX, rowY[s.index] ?? []);
    const long = runs.filter((r) => r.length > 1);
    const path = long.length ? long.map(runPath).join("") : null;
    const area = options.area && long.length ? long.map((r) => runArea(r, baseline)).join("") : null;
    const markers = sparse ? runs.flat() : runs.flatMap((r) => r.slice(-1));
    return { series: s.index, slot: s.slot, shape: s.shape, path, area, markers };
  });

  return {
    width,
    height,
    plot,
    yTicks,
    zeroY,
    xLabels,
    rowX,
    rowY,
    order,
    series,
    markerRadius: round2(clamp(fontSize * 0.3, 2.5, 5)),
  };
}

/** The placeable row nearest to pixel `px`, by binary search over `order`. */
export function nearestRow(rowPos: readonly (number | null)[], order: readonly number[], px: number): number | null {
  if (order.length === 0 || !Number.isFinite(px)) return null;
  let lo = 0;
  let hi = order.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const at = rowPos[order[mid] as number] ?? 0;
    if (at < px) lo = mid + 1;
    else hi = mid;
  }
  const here = order[lo] as number;
  const before = order[lo - 1];
  if (before === undefined) return here;
  return Math.abs((rowPos[before] ?? 0) - px) <= Math.abs((rowPos[here] ?? 0) - px) ? before : here;
}

/* ------------------------------------------------------------------ */
/*  Bars                                                               */
/* ------------------------------------------------------------------ */

export type BarOrientation = "vertical" | "horizontal";

export interface BarRect {
  series: number;
  slot: SeriesSlot;
  row: number;
  d: string;
  /** The bar's box (px). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BarBand {
  row: number;
  /** Start and size along the category axis (x when vertical, y when horizontal). */
  start: number;
  size: number;
  center: number;
}

export interface BarPlan {
  orientation: BarOrientation;
  width: number;
  /** For horizontal bars, derived from the category count. */
  height: number;
  plot: Rect;
  /** Along y when vertical, along x when horizontal. */
  valueTicks: ValueTick[];
  /** Where zero sits along the value axis (the bars' base). */
  zero: number;
  /** Vertical: x labels under the plot. Horizontal: `at` is the band's centre y. */
  categoryLabels: AxisLabel[];
  bands: BarBand[];
  bars: BarRect[];
  /** Values at the bar tips (horizontal, unstacked). */
  values: { x: number; y: number; text: string; anchor: "start" | "end" }[];
  /** Band position per model row (its centre), `null` when not drawn: what the readout steps through. */
  rowPos: (number | null)[];
  order: number[];
}

export interface BarPlanOptions {
  orientation?: BarOrientation;
  stacked?: boolean;
  min?: number;
  max?: number;
  formatters: Formatters;
  /** The bar thickness the theme asks for (`--BAR-THICK`), px. */
  barThick: number;
  /** The data-end radius (`--RADIUS-SM`), px. */
  radius: number;
}

/** The surface gap between touching bars (px), as the mark spec asks. */
const BAR_GAP = 2;

/** What the value axis must hold: every bar's value, or every stack's positive and negative totals. */
function* barDomainValues(placed: readonly PlacedRow[], drawn: readonly DrawnSeries[], stacked: boolean): Generator<number> {
  for (const { r } of placed) {
    if (stacked) {
      let pos = 0;
      let neg = 0;
      for (const s of drawn) {
        const v = r.values[s.index] ?? null;
        if (v === null) continue;
        if (v >= 0) pos += v;
        else neg += v;
      }
      yield pos;
      yield neg;
    } else for (const s of drawn) {
      const v = r.values[s.index];
      if (v !== null && v !== undefined) yield v;
    }
  }
}

interface BarFrame {
  plot: Rect;
  height: number;
  scale: NiceScale;
  /** The size of one category's band along the category axis (px). */
  band: number;
}

/**
 * Horizontal bars: a gutter for the widest category label, room at the end for
 * the tip values, the densest value ticks whose labels fit along the bottom, and
 * a height that grows with the category count.
 */
function horizontalBarFrame(
  placed: readonly PlacedRow[],
  drawn: readonly DrawnSeries[],
  domain: Domain,
  { width, fontSize, measure }: PlotBox,
  options: BarPlanOptions,
  groupThick: number,
): BarFrame {
  const { formatters, min, max } = options;
  const band = Math.max(groupThick + fontSize * 0.6, fontSize * 1.7);
  const gutter = Math.min(placed.reduce((most, { r }) => Math.max(most, measure(r.axisLabel)), 0) + fontSize * 0.75, width * 0.4);
  const tip =
    options.stacked === true
      ? fontSize * 0.5
      : Math.min(
          placed.reduce((most, { r }) => Math.max(most, ...drawn.map((s) => measure(formatters.value(r.values[s.index] ?? Number.NaN)))), 0) +
            fontSize * 0.6,
          width * 0.3,
        );
  const left = round2(gutter);
  const right = round2(width - tip);
  let scale = valueScale(domain, 0, fontSize, min, max, 2);
  for (let count = Math.max(2, Math.floor((right - left) / (fontSize * 3))); count > 2; count -= 1) {
    const candidate = valueScale(domain, 0, fontSize, min, max, count);
    const at = linearScale(candidate.lo, candidate.hi, left, right);
    if (fitLabels(candidate.ticks.map((v) => ({ at: at(v) ?? left, text: formatters.tick(v) })), measure, 0, width, fontSize)) {
      scale = candidate;
      break;
    }
  }
  const top = round2(fontSize * 0.3);
  const bottom = round2(top + placed.length * band);
  return { plot: { left, right, top, bottom }, height: round2(bottom + fontSize * 1.9), scale, band };
}

/** Vertical bars: the line chart's frame, the plot's width shared equally between the categories. */
function verticalBarFrame(count: number, domain: Domain, box: PlotBox, options: BarPlanOptions): BarFrame {
  const { height, fontSize } = box;
  const scale = valueScale(domain, height - fontSize * 2.6, fontSize, options.min, options.max);
  const plot = verticalFrame(box, scale.ticks.map((v) => ({ label: options.formatters.tick(v) })));
  return { plot, height, scale, band: count > 0 ? (plot.right - plot.left) / count : 0 };
}

/** Horizontal: every category, cut to the gutter. Vertical: calendar boundaries on a time axis, else thinned. */
function barCategoryLabels(model: CartesianModel, bands: readonly BarBand[], plot: Rect, horizontal: boolean, { width, fontSize, measure }: PlotBox): AxisLabel[] {
  const labelOf = (b: BarBand) => model.rows[b.row]?.axisLabel ?? "";
  if (horizontal) {
    const max = plot.left - fontSize * 0.75;
    return bands.map((b) => {
      const text = fitText(labelOf(b), max, measure);
      return { at: b.center, center: b.center, text, width: measure(text) };
    });
  }
  const gap = fontSize;
  const timed =
    model.xType === "time"
      ? bandTimeLabels(
          bands.map((b) => model.rows[b.row]?.x ?? null),
          bands.map((b) => b.center),
          measure,
          0,
          width,
          gap,
          model.zone,
          model.locale,
        )
      : null;
  return timed ?? thinLabels(bands.map((b) => ({ at: b.center, text: labelOf(b) })), measure, 0, width, gap);
}

export function planBars(model: CartesianModel, box: PlotBox, options: BarPlanOptions): BarPlan | null {
  const { width, fontSize } = box;
  const horizontal = options.orientation === "horizontal";
  const stacked = options.stacked === true;
  if (!model.drawable || !(width > MIN_PLOT * 2)) return null;
  if (!horizontal && !(box.height > MIN_PLOT * 2)) return null;

  const drawn = drawnSeries(model.series);
  const placed = placedRows(model);
  const order = placed.map(({ i }) => i);
  const k = stacked ? 1 : Math.max(1, drawn.length);
  const thick = Math.max(1, Number.isFinite(options.barThick) && options.barThick > 0 ? options.barThick : fontSize);

  // A bar's length encodes magnitude, so the domain always holds zero.
  const domain = dataDomain(barDomainValues(placed, drawn, stacked), true);
  if (!domain) return null;

  const { plot, height, scale, band } = horizontal
    ? horizontalBarFrame(placed, drawn, domain, box, options, k * thick + (k - 1) * BAR_GAP)
    : verticalBarFrame(placed.length, domain, box, options);
  if (plot.right - plot.left < MIN_PLOT || plot.bottom - plot.top < Math.min(MIN_PLOT, band)) return null;

  const project = horizontal ? linearScale(scale.lo, scale.hi, plot.left, plot.right) : linearScale(scale.lo, scale.hi, plot.bottom, plot.top);
  const valueTicks = scale.ticks.map((v) => ({ pos: round2(project(v) ?? (horizontal ? plot.left : plot.bottom)), label: options.formatters.tick(v) }));
  const zero = round2(clamp(project(0) ?? (horizontal ? plot.left : plot.bottom), Math.min(plot.top, plot.left), Math.max(plot.bottom, plot.right)));

  const axisStart = horizontal ? plot.top : plot.left;
  const bands: BarBand[] = placed.map(({ i }, pos) => {
    const start = axisStart + pos * band;
    return { row: i, start: round2(start), size: round2(band), center: round2(start + band / 2) };
  });
  const rowPos: (number | null)[] = model.rows.map(() => null);
  for (const b of bands) rowPos[b.row] = b.center;

  // Thickness: the theme's, shrunk only when the band cannot hold the group.
  const room = band * 0.8;
  const t = Math.max(1, Math.min(thick, (room - (k - 1) * BAR_GAP) / k));
  const group = k * t + (k - 1) * BAR_GAP;

  const bars: BarRect[] = [];
  const tips: BarPlan["values"] = [];
  const rect = (b: BarBand, offset: number, from: number, to: number, end: boolean, s: DrawnSeries) => {
    const lo = Math.min(from, to);
    const len = Math.abs(to - from);
    if (len <= 0) return;
    const across = b.center - group / 2 + offset;
    const grows = to >= from;
    const [x, y, w, h] = horizontal ? [lo, across, len, t] : [across, lo, t, len];
    // Vertical pixels grow downward: a value growing up ends at the top.
    const d = barPath(x, y, w, h, options.radius, !end ? "none" : horizontal ? (grows ? "right" : "left") : grows ? "bottom" : "top");
    bars.push({ series: s.index, slot: s.slot, row: b.row, d, x: round2(x), y: round2(y), w: round2(w), h: round2(h) });
  };

  for (const b of bands) {
    const row = model.rows[b.row];
    if (!row) continue;
    if (stacked) {
      let pos = 0;
      let neg = 0;
      const live = drawn.filter((s) => (row.values[s.index] ?? null) !== null && row.values[s.index] !== 0);
      const lastPos = [...live].reverse().find((s) => (row.values[s.index] ?? 0) > 0);
      const lastNeg = [...live].reverse().find((s) => (row.values[s.index] ?? 0) < 0);
      for (const s of live) {
        const v = row.values[s.index] as number;
        const from = v > 0 ? pos : neg;
        const to = from + v;
        if (v > 0) pos = to;
        else neg = to;
        const a = project(from);
        const z = project(to);
        if (a === null || z === null) continue;
        const outer = s === (v > 0 ? lastPos : lastNeg);
        // The surface gap sits at each inner segment's outer end.
        const dir = Math.sign(z - a);
        const zGap = outer || Math.abs(z - a) <= BAR_GAP * 2 ? z : z - dir * BAR_GAP;
        rect(b, 0, a, zGap, outer, s);
      }
    } else {
      drawn.forEach((s, j) => {
        const v = row.values[s.index] ?? null;
        const end = project(v);
        if (v === null || end === null) return;
        rect(b, j * (t + BAR_GAP), zero, end, true, s);
        if (horizontal) {
          const across = b.center - group / 2 + j * (t + BAR_GAP) + t / 2;
          tips.push({
            x: round2(v >= 0 ? end + fontSize * 0.35 : end - fontSize * 0.35),
            y: round2(across),
            text: options.formatters.value(v),
            anchor: v >= 0 ? "start" : "end",
          });
        }
      });
    }
  }

  const categoryLabels = barCategoryLabels(model, bands, plot, horizontal, box);
  return { orientation: horizontal ? "horizontal" : "vertical", width, height, plot, valueTicks, zero, categoryLabels, bands, bars, values: tips, rowPos, order };
}

/* ------------------------------------------------------------------ */
/*  Heatmap                                                            */
/* ------------------------------------------------------------------ */

export const MAX_HEAT_ROWS = 64;
export const MAX_HEAT_COLUMNS = 168;
/** The sequential ramp's steps: 1 is the greatest magnitude. */
export const HEAT_STEPS = 7;
export type HeatStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface HeatmapInput {
  rows?: readonly unknown[] | null;
  columns?: readonly unknown[] | null;
  /** `values[row][column]`. */
  values?: readonly (readonly unknown[] | null | undefined)[] | null;
}

export interface HeatCell {
  row: number;
  column: number;
  value: number | null;
  /** The ramp step, or `null` for a missing value. */
  step: HeatStep | null;
}

export interface HeatmapModel {
  rows: string[];
  columns: string[];
  cells: HeatCell[][];
  lo: number;
  hi: number;
  drawable: boolean;
  dropped: { rows: number; columns: number };
}

/**
 * The ramp step for `value` in `[lo, hi]`: seven equal bins, the greatest
 * magnitude at step 1. A zero span is no magnitude at all, so it takes the
 * faintest step.
 */
export function heatStep(value: number, lo: number, hi: number): HeatStep {
  const { scale, span } = safeSpan(lo, hi);
  if (!(span > 0)) return HEAT_STEPS;
  const t = clamp((value * scale - lo * scale) / span, 0, 1);
  const bin = Math.min(HEAT_STEPS - 1, Math.floor(t * HEAT_STEPS));
  return (HEAT_STEPS - bin) as HeatStep;
}

export function modelHeatmap(input: HeatmapInput): HeatmapModel {
  const suppliedRows: readonly unknown[] = Array.isArray(input.rows) ? input.rows : [];
  const suppliedCols: readonly unknown[] = Array.isArray(input.columns) ? input.columns : [];
  const suppliedValues: readonly unknown[] = Array.isArray(input.values) ? input.values : [];
  const totalRows = Math.max(suppliedRows.length, suppliedValues.length);
  const rowCount = Math.min(totalRows, MAX_HEAT_ROWS);
  const grid = suppliedValues.slice(0, rowCount).map((r) => (Array.isArray(r) ? (r as readonly unknown[]).slice(0, MAX_HEAT_COLUMNS) : []));
  const longest = suppliedValues
    .slice(0, rowCount)
    .reduce<number>((most, r) => Math.max(most, Array.isArray(r) ? (r as readonly unknown[]).length : 0), 0);
  const totalCols = Math.max(suppliedCols.length, longest);
  const colCount = Math.min(totalCols, MAX_HEAT_COLUMNS);

  const rows = Array.from({ length: rowCount }, (_, i) => tidyLabel(suppliedRows[i]) || String(i + 1));
  const columns = Array.from({ length: colCount }, (_, i) => {
    const raw = suppliedCols[i];
    return tidyLabel(typeof raw === "number" ? String(raw) : raw) || String(i + 1);
  });

  let lo = 0;
  let hi = -Infinity;
  let any = false;
  const values = rows.map((_, r) =>
    columns.map((__, c) => {
      const raw = grid[r]?.[c];
      const v = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      if (v !== null) {
        any = true;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return v;
    }),
  );
  if (!any) hi = 0;
  const cells = values.map((row, r) => row.map((value, c) => ({ row: r, column: c, value, step: value === null ? null : heatStep(value, lo, hi) })));
  return {
    rows,
    columns,
    cells,
    lo,
    hi,
    drawable: any,
    dropped: { rows: totalRows - rowCount, columns: totalCols - colCount },
  };
}

/** The legend: each step with the lower edge of its bin, faintest first. */
export function heatLegend(model: HeatmapModel, formatters: Formatters): { step: HeatStep; from: string }[] {
  const { lo, hi } = model;
  const { scale, span } = safeSpan(lo, hi);
  return Array.from({ length: HEAT_STEPS }, (_, bin) => ({
    step: (HEAT_STEPS - bin) as HeatStep,
    from: formatters.value(span > 0 ? (lo * scale + (span * bin) / HEAT_STEPS) / scale : lo),
  }));
}

export interface HeatAxisPlan {
  /** The row-label column's width (px): the widest fitted label, at most 30% of the box. */
  labelWidth: number;
  rowLabels: string[];
  /** Column labels that fit, centred on their columns (px from the box's start). */
  columnLabels: (AxisLabel & { column: number })[];
}

/** One pixel between cells (the surface gap's hairline form). */
export const HEAT_GAP = 1;

/**
 * Where the heatmap's labels go at `width`: row labels cut to a third of the box
 * at most, column labels thinned from the first (hours read from midnight) until
 * none overlaps.
 */
export function planHeatAxis(model: HeatmapModel, width: number, fontSize: number, measure: Measure): HeatAxisPlan {
  const cap = Math.max(fontSize * 2, width * 0.3);
  const rowLabels = model.rows.map((r) => fitText(r, cap, measure));
  const labelWidth = round2(Math.min(cap, rowLabels.reduce((most, r) => Math.max(most, measure(r)), 0) + fontSize * 0.6));
  const n = model.columns.length;
  const colW = n > 0 ? (width - labelWidth - HEAT_GAP * n) / n : 0;
  const ticks = model.columns.map((text, i) => ({ at: labelWidth + HEAT_GAP + (colW + HEAT_GAP) * i + colW / 2, text: tidyLabel(text, MAX_AXIS_CHARS) }));
  const placed = colW > 0 ? thinLabels(ticks, measure, labelWidth, width, fontSize * 0.75, "first") : [];
  const columnOf = new Map(ticks.map((t, i) => [t.at, i]));
  return {
    labelWidth,
    rowLabels,
    columnLabels: placed.map((l) => ({ ...l, column: columnOf.get(l.at) ?? 0 })),
  };
}
