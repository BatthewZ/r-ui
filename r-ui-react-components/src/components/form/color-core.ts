/*
 * Colour maths for ColorPicker: OKLCH <-> sRGB, the sRGB gamut, parsing and
 * formatting the two wire formats (hex and `oklch()`), and WCAG 2.x contrast.
 * Pure and dependency-free. Internal: not re-exported from the group's index.
 *
 * OKLCH is the editing space (lightness, chroma and hue are separate levers, so
 * "lighter" and "more contrast" move together); sRGB is the gamut every value is
 * kept inside, so a hex and an `oklch()` value always name the same colour.
 */

/** OKLCH: `l` 0–1, `c` ≥ 0 (sRGB tops out near 0.33), `h` degrees 0–360. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Gamma-encoded sRGB channels, 0–1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** A parsed colour: OKLCH as written (possibly outside sRGB) and its alpha, 0–1. */
export interface ParsedColor {
  color: Oklch;
  alpha: number;
}

type Vec3 = [number, number, number];

const toRad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// Björn Ottosson's OKLab matrices (https://bottosson.github.io/posts/oklab/).
function oklabToLinear(L: number, a: number, b: number): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToOklab(r: number, g: number, b: number): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Linear sRGB for an OKLCH colour, unclipped (a channel outside 0–1 is out of gamut). */
function oklchToLinear({ l, c, h }: Oklch): Vec3 {
  return oklabToLinear(l, c * Math.cos(toRad(h)), c * Math.sin(toRad(h)));
}

// Float noise at the gamut's edge (white is 1.0000000002) is not "outside".
const GAMUT_EPSILON = 1e-6;
const linearInGamut = (rgb: Vec3) => rgb.every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON);

export function inGamut(color: Oklch): boolean {
  return linearInGamut(oklchToLinear(color));
}

/** The most chroma sRGB holds at this lightness and hue (binary search; 0 at black and white). */
export function maxChroma(l: number, h: number): number {
  if (l <= 0 || l >= 1) return 0;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h })) lo = mid;
    else hi = mid;
  }
  return lo;
}

const hueCeilings = new Map<number, number>();

/**
 * The most chroma sRGB holds at this hue, at any lightness: the area's chroma
 * axis spans this, so a narrow hue (cyan) still fills the area rather than a
 * sliver of it. Cached per half degree.
 */
export function hueMaxChroma(h: number): number {
  const key = Math.round(normalizeHue(h) * 2) / 2;
  const cached = hueCeilings.get(key);
  if (cached !== undefined) return cached;
  let best = 0;
  for (let l = 0.02; l < 1; l += 0.02) best = Math.max(best, maxChroma(l, key));
  // A whisker of headroom, so the brightest point is reachable inside the axis.
  const ceiling = best * 1.02;
  hueCeilings.set(key, ceiling);
  return ceiling;
}

const normalizeHue = (h: number) => ((h % 360) + 360) % 360;

/** The colour moved into sRGB by lowering chroma at constant lightness and hue. */
export function toGamut(color: Oklch): Oklch {
  const l = clamp(color.l, 0, 1);
  if (inGamut({ ...color, l })) return { ...color, l };
  return { l, c: maxChroma(l, color.h), h: color.h };
}

/** sRGB for an OKLCH colour: gamut-mapped by chroma, then clipped (only float noise is left to clip). */
export function oklchToRgb(color: Oklch): Rgb {
  const [r, g, b] = oklchToLinear(toGamut(color)).map((v) => encode(clamp(v, 0, 1))) as Vec3;
  return { r, g, b };
}

/** OKLCH for an sRGB colour. An achromatic colour (no chroma) gets hue 0; callers keep their own. */
export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const [L, A, B] = linearToOklab(decode(r), decode(g), decode(b));
  const c = Math.hypot(A, B);
  return { l: clamp(L, 0, 1), c: c < 1e-4 ? 0 : c, h: c < 1e-4 ? 0 : normalizeHue((Math.atan2(B, A) * 180) / Math.PI) };
}

/**
 * Paints the lightness × chroma plane at one hue into RGBA pixels (a canvas's
 * `ImageData.data`): lightness 1 at the top row to 0 at the bottom, chroma 0 at
 * the first column to `axis` at the last. Pixels outside sRGB stay transparent,
 * so the gamut's edge is drawn by whatever lies behind the canvas.
 */
export function paintPlane(data: Uint8ClampedArray, width: number, height: number, hue: number, axis: number): void {
  const cos = Math.cos(toRad(hue));
  const sin = Math.sin(toRad(hue));
  for (let y = 0; y < height; y += 1) {
    const l = 1 - y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const c = (x / Math.max(1, width - 1)) * axis;
      const rgb = oklabToLinear(l, c * cos, c * sin);
      const i = (y * width + x) * 4;
      if (!linearInGamut(rgb)) {
        data[i + 3] = 0;
        continue;
      }
      data[i] = Math.round(encode(clamp(rgb[0], 0, 1)) * 255);
      data[i + 1] = Math.round(encode(clamp(rgb[1], 0, 1)) * 255);
      data[i + 2] = Math.round(encode(clamp(rgb[2], 0, 1)) * 255);
      data[i + 3] = 255;
    }
  }
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (the `#` optional), any case. */
export function parseHex(text: string): { rgb: Rgb; alpha: number } | null {
  const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text.trim());
  if (!match?.[1]) return null;
  let hex = match[1];
  if (hex.length <= 4) hex = [...hex].map((x) => x + x).join("");
  const byte = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
  return { rgb: { r: byte(0), g: byte(2), b: byte(4) }, alpha: hex.length === 8 ? byte(6) : 1 };
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** A CSS number, or a percentage scaled so 100% = `percent`; `null` when neither. */
function cssNumber(token: string, percent: number): number | null {
  if (token === "none") return 0;
  if (token.endsWith("%")) {
    const n = token.slice(0, -1);
    return NUMBER.test(n) ? (Number(n) / 100) * percent : null;
  }
  return NUMBER.test(token) ? Number(token) : null;
}

function cssHue(token: string): number | null {
  const unit = /^(.*?)(deg|turn|rad|grad)?$/i.exec(token);
  const n = unit?.[1] === undefined ? null : cssNumber(unit[1], Number.NaN);
  if (n === null || Number.isNaN(n)) return null;
  const scale = { deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 }[(unit?.[2] ?? "deg").toLowerCase() as "deg"];
  return normalizeHue(n * scale);
}

/** The arguments of `name(…)`, split on spaces (or commas) and one `/`; `null` if it is another function. */
function functionArgs(text: string, names: readonly string[]): { name: string; parts: string[]; alpha?: string } | null {
  const match = /^([a-z]+)\(\s*([^()]*)\)$/i.exec(text.trim());
  const name = match?.[1]?.toLowerCase();
  if (!match?.[2] || !name || !names.includes(name)) return null;
  const [main = "", alpha, extra] = match[2].split("/");
  if (extra !== undefined) return null;
  const parts = main.trim().split(/[\s,]+/).filter(Boolean);
  const commas = main.includes(",");
  // Legacy comma syntax carries alpha as a fourth argument.
  if (commas && alpha === undefined && parts.length === 4) return { name, parts: parts.slice(0, 3), alpha: parts[3] };
  return { name, parts, alpha: alpha?.trim() };
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const a = cssNumber(token, 1);
  return a === null || a < 0 || a > 1 ? null : a;
}

/**
 * `oklch(L C H [/ A])`: L a number 0–1 or a percentage, C a number or a
 * percentage of 0.4, H a number or an angle; alpha a number or a percentage.
 * Chroma is kept as written, even outside sRGB.
 */
export function parseOklch(text: string): ParsedColor | null {
  const args = functionArgs(text, ["oklch"]);
  if (!args || args.parts.length !== 3) return null;
  const [lt = "", ct = "", ht = ""] = args.parts;
  const l = cssNumber(lt, 1);
  const c = cssNumber(ct, 0.4);
  const h = cssHue(ht);
  const alpha = parseAlpha(args.alpha);
  if (l === null || c === null || h === null || alpha === null) return null;
  if (l < 0 || l > 1 || c < 0) return null;
  return { color: { l, c, h }, alpha };
}

/** What a person may type: hex or `oklch()`, nothing else. */
export function parseColorInput(text: string): ParsedColor | null {
  const hex = parseHex(text);
  if (hex) return { color: rgbToOklch(hex.rgb), alpha: hex.alpha };
  return parseOklch(text);
}

/**
 * What a browser hands back: everything `parseColorInput` reads, plus
 * `rgb()`/`rgba()` (legacy commas or modern spaces) and `color(srgb …)`, the
 * forms `getComputedStyle` serialises to. For resolving a background, not for
 * people's input.
 */
export function parseCssColor(text: string): ParsedColor | null {
  const typed = parseColorInput(text);
  if (typed) return typed;
  const rgb = functionArgs(text, ["rgb", "rgba"]);
  if (rgb && rgb.parts.length === 3) {
    const channels = rgb.parts.map((p) => cssNumber(p, 255));
    const alpha = parseAlpha(rgb.alpha);
    if (channels.some((v) => v === null) || alpha === null) return null;
    const [r = 0, g = 0, b = 0] = channels.map((v) => clamp((v ?? 0) / 255, 0, 1));
    return { color: rgbToOklch({ r, g, b }), alpha };
  }
  const match = /^color\(\s*srgb\s+([^()]*)\)$/i.exec(text.trim());
  if (match?.[1]) {
    const [main = "", alphaPart] = match[1].split("/");
    const channels = main.trim().split(/\s+/).map((p) => cssNumber(p, 1));
    const alpha = parseAlpha(alphaPart?.trim());
    if (channels.length !== 3 || channels.some((v) => v === null) || alpha === null) return null;
    const [r = 0, g = 0, b = 0] = channels.map((v) => clamp(v ?? 0, 0, 1));
    return { color: rgbToOklch({ r, g, b }), alpha };
  }
  return null;
}

// ── Formatting ─────────────────────────────────────────────────────────────

const byteHex = (v: number) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");

/** `#rrggbb`, or `#rrggbbaa` when `alpha` is below 1. Lowercase. */
export function formatHex(rgb: Rgb, alpha = 1): string {
  const a = Math.round(clamp(alpha, 0, 1) * 255) < 255 ? byteHex(alpha) : "";
  return `#${byteHex(rgb.r)}${byteHex(rgb.g)}${byteHex(rgb.b)}${a}`;
}

/** Fixed decimals with trailing zeros dropped (`0.500` → `0.5`). */
const decimals = (n: number, places: number) => String(Number(n.toFixed(places)));

/**
 * `oklch(L C H)` or `oklch(L C H / A)`. Chroma is rounded DOWN, so a colour on
 * the gamut's edge still parses back inside it.
 */
export function formatOklch(color: Oklch, alpha = 1): string {
  const c = Math.floor(Math.max(0, color.c) * 1000) / 1000;
  const a = alpha < 0.995 ? ` / ${decimals(clamp(alpha, 0, 1), 2)}` : "";
  return `oklch(${decimals(clamp(color.l, 0, 1), 3)} ${decimals(c, 3)} ${decimals(normalizeHue(color.h), 1)}${a})`;
}

/** `rgb(r g b / a)` from 0–255 channels, for painting (gradient stops, canvas). */
export function cssRgb(rgb: Rgb, alpha = 1): string {
  const ch = (v: number) => Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${ch(rgb.r)} ${ch(rgb.g)} ${ch(rgb.b)} / ${decimals(clamp(alpha, 0, 1), 3)})`;
}

// ── Contrast (WCAG 2.x) ────────────────────────────────────────────────────

const luminance = ({ r, g, b }: Rgb) => 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);

/** `fg` with `alpha` laid over an opaque `bg`, in gamma-encoded sRGB as browsers composite. */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const mix = (f: number, b: number) => f * alpha + b * (1 - alpha);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b) };
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Which WCAG text levels a ratio meets: AA 4.5:1, AAA 7:1 (normal-size text). */
export function wcagLevels(ratio: number): { aa: boolean; aaa: boolean } {
  return { aa: ratio >= 4.5, aaa: ratio >= 7 };
}
