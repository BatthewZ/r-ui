// Splitter maths, free of React and the DOM. A size is a pane's share (0–100) of
// the space the panes divide, which is the splitter's length minus its separators.

const EPS = 1e-6;

/** A pane's bounds as shares (0–100) of the space the panes divide. */
export interface PaneBounds {
  min: number;
  max: number;
  /** It may also sit at 0, collapsed, below its `min`. */
  collapsible: boolean;
}

const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);
const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), Math.max(lo, hi));
/** Two decimals: a hundredth of a percent is under a pixel on any screen, and persisted sizes stay short. */
export const roundSize = (value: number) => Math.round(value * 100) / 100;

/** `count` sizes summing to 100: the given ones scaled, or an equal split when they cannot be used. */
export function normalizeSizes(sizes: readonly number[] | undefined, count: number): number[] {
  const equal = Array.from({ length: count }, () => 100 / count);
  if (!sizes || sizes.length !== count || sizes.some((s) => !Number.isFinite(s) || s < 0)) return equal;
  const total = sum(sizes);
  return total > EPS ? sizes.map((s) => (s * 100) / total) : equal;
}

/** Whether pane `index` is collapsed: collapsible and at 0. */
export const isCollapsed = (sizes: readonly number[], bounds: readonly PaneBounds[], index: number) =>
  Boolean(bounds[index]?.collapsible) && (sizes[index] ?? 0) <= EPS;

/**
 * The sizes as they can be drawn: each pane inside its bounds (a collapsed one
 * stays at 0), and what that freed or took spread over the panes that still have
 * room, in proportion to that room. When the bounds cannot all hold (minimums
 * that add up past 100), the panes stay at their bounds and the layout scales them.
 */
export function fitSizes(sizes: readonly number[], bounds: readonly PaneBounds[]): number[] {
  const collapsed = sizes.map((_, i) => isCollapsed(sizes, bounds, i));
  const out = sizes.map((s, i) => (collapsed[i] ? 0 : clamp(s, bounds[i]?.min ?? 0, bounds[i]?.max ?? 100)));
  const diff = 100 - sum(out);
  if (Math.abs(diff) < EPS) return out;
  const room = out.map((s, i) => {
    if (collapsed[i]) return 0;
    const b = bounds[i] ?? { min: 0, max: 100 };
    return Math.max(0, diff > 0 ? Math.max(b.min, b.max) - s : s - b.min);
  });
  const totalRoom = sum(room);
  if (totalRoom < EPS) return out;
  const share = Math.min(1, Math.abs(diff) / totalRoom);
  return out.map((s, i) => s + Math.sign(diff) * (room[i] ?? 0) * share);
}

/**
 * The pane a separator reports and resizes (APG window splitter): the one
 * before it, unless only the one after it can collapse, so Enter has a pane to
 * collapse on either side.
 */
export function primaryPane(bounds: readonly PaneBounds[], separator: number): number {
  const before = separator;
  const after = separator + 1;
  return !bounds[before]?.collapsible && bounds[after]?.collapsible ? after : before;
}

export interface PairRange {
  /** The primary pane's index, and the other pane's: the separator moves space between the two only. */
  primary: number;
  other: number;
  /** The two panes' sizes added up; a move keeps it. */
  total: number;
  /** The primary pane's smallest open size and its largest, given both panes' bounds. */
  lo: number;
  hi: number;
  collapsible: boolean;
}

/** What separator `separator` (between panes `separator` and `separator + 1`) can do. */
export function pairRange(sizes: readonly number[], bounds: readonly PaneBounds[], separator: number): PairRange {
  const primary = primaryPane(bounds, separator);
  const other = primary === separator ? separator + 1 : separator;
  const p = bounds[primary] ?? { min: 0, max: 100, collapsible: false };
  const o = bounds[other] ?? { min: 0, max: 100, collapsible: false };
  const total = (sizes[primary] ?? 0) + (sizes[other] ?? 0);
  const lo = Math.min(total, Math.max(p.min, total - o.max, 0));
  const hi = Math.max(lo, Math.min(p.max, total - o.min, total));
  return { primary, other, total, lo, hi, collapsible: p.collapsible };
}

/** `sizes` with the primary pane at `value` and the other pane taking the rest of the pair. */
export function placePrimary(sizes: readonly number[], range: PairRange, value: number): number[] {
  const next = [...sizes];
  const v = roundSize(value);
  next[range.primary] = v;
  next[range.other] = roundSize(range.total - v);
  return next;
}

/** The primary pane's smallest open size: its bound, or one step when the bound is 0. */
export const openMin = (range: PairRange, step: number) => (range.lo > EPS ? range.lo : Math.min(step, range.hi));

export type SplitterKey = "grow" | "shrink" | "min" | "max";

/**
 * The primary pane's next size for a key: a step either way, stopping at each
 * bound before passing it (a collapsible pane collapses from its minimum, and
 * opens back to it); `min` is collapsed when it can be, `max` the largest.
 */
export function keyTarget(current: number, range: PairRange, key: SplitterKey, step: number): number {
  const collapsed = range.collapsible && current <= EPS;
  switch (key) {
    case "min":
      return range.collapsible ? 0 : range.lo;
    case "max":
      return range.hi;
    case "grow":
      return collapsed ? openMin(range, step) : Math.min(current + step, range.hi);
    case "shrink":
      if (collapsed) return 0;
      if (current - step >= range.lo - EPS) return Math.max(current - step, range.lo);
      if (current > range.lo + EPS) return range.lo;
      return range.collapsible ? 0 : range.lo;
  }
}

/**
 * The primary pane's size for a drag that proposes `value`: inside its bounds,
 * and for a collapsible pane, collapsed once dragged below half its minimum.
 */
export function dragTarget(value: number, range: PairRange): number {
  if (range.collapsible && value < range.lo / 2) return 0;
  return clamp(value, range.lo, range.hi);
}
