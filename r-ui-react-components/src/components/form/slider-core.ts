// The arithmetic behind the slider family (Slider, RangeSlider, ColorPicker's
// own sliders): snapping, positions, keys and thumbs that never cross. Pure, so
// it is tested without a DOM.

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const MAX_DIGITS = 20;

/** Fraction digits `n` is written with (`0.05` → 2, `1e-7` → 7). */
export function decimalsOf(n: number): number {
  const [mantissa = "", exponent = "0"] = String(n).split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return clamp(fraction - Number(exponent), 0, MAX_DIGITS);
}

const roundTo = (n: number, digits: number) => Number(n.toFixed(digits));

export interface SliderScale {
  min: number;
  max: number;
  /** Positive; a value sits on `min + k × step`. */
  step: number;
}

/**
 * `value` on the scale: inside `[min, max]`, on `min + k × step` (the nearest,
 * ties up), and never past `max` when `max` is off the grid (the last step
 * below it, as a native range input does). Free of float noise (`0.3`, not
 * `0.30000000000000004`). A non-finite value is `min`.
 */
export function snapToStep(value: number, { min, max, step }: SliderScale): number {
  if (!Number.isFinite(value)) return min;
  const clamped = clamp(value, min, max);
  if (!(step > 0)) return clamped;
  let snapped = min + Math.round((clamped - min) / step) * step;
  if (snapped > max) snapped -= step;
  return clamp(roundTo(snapped, Math.max(decimalsOf(step), decimalsOf(min))), min, max);
}

/** Where `value` sits along the scale, 0–1. An empty scale (`max <= min`) is 0. */
export function fractionOf(value: number, min: number, max: number): number {
  return max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
}

export type SliderOrientation = "horizontal" | "vertical";

export interface SliderKeyOptions extends SliderScale {
  /** Page Up/Down, and Shift with an arrow. */
  largeStep: number;
  /** A horizontal slider in RTL runs from the right: ArrowLeft increases. */
  rtl: boolean;
  orientation: SliderOrientation;
}

/**
 * The value a key asks for (before snapping and clamping), or `null` for a key
 * the slider leaves alone. WAI-ARIA APG slider: Right/Up increase, Left/Down
 * decrease (mirrored on a horizontal RTL slider), Page Up/Down and Shift+arrow
 * move a large step, Home/End go to the ends.
 */
export function keyTarget(
  key: string,
  shiftKey: boolean,
  value: number,
  { min, max, step, largeStep, rtl, orientation }: SliderKeyOptions,
): number | null {
  const by = shiftKey ? largeStep : step;
  const toEnd = rtl && orientation === "horizontal" ? -1 : 1;
  switch (key) {
    case "ArrowRight":
      return value + by * toEnd;
    case "ArrowLeft":
      return value - by * toEnd;
    case "ArrowUp":
      return value + by;
    case "ArrowDown":
      return value - by;
    case "PageUp":
      return value + largeStep;
    case "PageDown":
      return value - largeStep;
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}

export interface ThumbScale extends SliderScale {
  /** The least distance between neighbouring thumbs, in value units. */
  gap: number;
}

const digitsOf = ({ min, step, gap }: ThumbScale) => Math.max(decimalsOf(step), decimalsOf(min), decimalsOf(gap));

/**
 * A caller's values as the scale can hold them: each snapped, in order, and
 * neighbours at least `gap` apart (pushed up, then pulled back under `max`).
 * Display only: what the caller holds is never rewritten behind its back.
 */
export function normalizeThumbs(values: readonly number[], scale: ThumbScale): number[] {
  const digits = digitsOf(scale);
  const out = values.map((v) => snapToStep(v, scale)).sort((a, b) => a - b);
  for (let i = 1; i < out.length; i += 1) out[i] = Math.max(out[i] ?? 0, roundTo((out[i - 1] ?? 0) + scale.gap, digits));
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const upper = i === out.length - 1 ? scale.max : roundTo((out[i + 1] ?? 0) - scale.gap, digits);
    out[i] = clamp(out[i] ?? 0, scale.min, Math.max(scale.min, upper));
  }
  return out;
}

/** The range thumb `index` may move in: its neighbours, `gap` away, else the scale's ends. */
export function thumbBounds(values: readonly number[], index: number, scale: ThumbScale): [number, number] {
  const digits = digitsOf(scale);
  const before = values[index - 1];
  const after = values[index + 1];
  return [
    before === undefined ? scale.min : roundTo(before + scale.gap, digits),
    after === undefined ? scale.max : roundTo(after - scale.gap, digits),
  ];
}

/**
 * `values` with thumb `index` moved toward `target`: snapped, then stopped at
 * its neighbours (thumbs push against each other and never cross or swap, per
 * the APG multi-thumb slider). The same array when nothing moves.
 */
export function moveThumb(values: readonly number[], index: number, target: number, scale: ThumbScale): readonly number[] {
  const current = values[index];
  if (current === undefined) return values;
  const [lo, hi] = thumbBounds(values, index, scale);
  const next = clamp(snapToStep(target, scale), lo, hi);
  if (next === current) return values;
  const out = values.slice();
  out[index] = next;
  return out;
}

/**
 * The thumb a press at `target` grabs: the nearest. Coincident thumbs go by
 * side (above them, the last; below, the first), except within `slop` of them
 * (a press on the stacked thumbs): then it is the pair, `[first, last]`, and
 * the drag's first direction decides.
 */
export function pickThumb(values: readonly number[], target: number, slop = 0): number | readonly [number, number] {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  values.forEach((v, i) => {
    const distance = Math.abs(v - target);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  const at = values[best];
  if (at === undefined) return 0;
  let last = best;
  while (values[last + 1] === at) last += 1;
  if (last === best) return best;
  if (Math.abs(target - at) <= slop) return [best, last];
  return target > at ? last : best;
}

export const sameValues = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
