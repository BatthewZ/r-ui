// Colour maths shared by the palette gates. OKLCH in, OKLab / sRGB out.
// Only the forms this package writes are parsed: `oklch(L C H)` with L as a
// 0–1 number or a percentage, C as a number, H in degrees.

/** `oklch(0.62 0.17 255)` / `oklch(62% 0.17 255)` -> { L, C, H }, or null. */
export function parseOklch(value) {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/.exec(value.trim());
  if (!m) return null;
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  return { L, C: Number(m[3]), H: Number(m[4]) };
}

/** OKLCH -> OKLab [L, a, b]. */
export function oklchToOklab({ L, C, H }) {
  const rad = (H * Math.PI) / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/** OKLab -> linear sRGB [r, g, b] (unclamped). */
export function oklabToLinearSrgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Linear sRGB -> OKLab. */
export function linearSrgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** `#rrggbb` -> linear sRGB. */
export function hexToLinearSrgb(hex) {
  const n = hex.replace("#", "");
  return [0, 2, 4].map((i) => toLinear(parseInt(n.slice(i, i + 2), 16) / 255));
}

/** OKLab -> OKLCH, rounded the way this package writes values. */
export function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H: C < 1e-4 ? 0 : H };
}

export const formatOklch = ({ L, C, H }) =>
  `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** WCAG relative luminance from linear sRGB (clamped into gamut). */
export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(clamp01);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(rgbA, rgbB) {
  const [hi, lo] = [relativeLuminance(rgbA), relativeLuminance(rgbB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Colour-vision-deficiency simulation, Machado, Oliveira & Fernandes (2009),
 * severity 1.0, applied in linear sRGB. Tritanopia is included for honesty; it
 * is rare, and the floor applied to it is the same collapse guard as the rest.
 */
export const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulate(matrix, rgb) {
  const [r, g, b] = rgb.map(clamp01);
  return matrix.map((row) => clamp01(row[0] * r + row[1] * g + row[2] * b));
}

/** Euclidean distance in OKLab: one scalar for lightness, chroma and hue together. */
export const deltaE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

export function oklchToLinearSrgb(lch) {
  return oklabToLinearSrgb(oklchToOklab(lch));
}
