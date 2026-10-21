/**
 * Colour text → WCAG 2.x contrast, React-free. The measurement mirrors the CSS
 * package's contrast check (OKLCH → linear sRGB → WCAG luminance; a
 * translucent colour composited in gamma-encoded sRGB over what is under it;
 * an out-of-gamut colour measured both by clipping and by reducing chroma at
 * constant lightness and hue, and the worse ratio kept), and a test holds the
 * two equal by behaviour. Parsing is wider than the check's: it reads what a
 * document may write (`types.ts`, the theme grammar) and what a browser
 * serialises a computed colour as (`rgb(1, 2, 3)`, `oklch(…)`, `color(srgb …)`).
 */

type Vector = readonly [number, number, number];
type Matrix = readonly [Vector, Vector, Vector];

/** A colour as the measurement takes it: gamma-free sRGB, or OKLCH (which may lie outside sRGB). */
export type Colour =
  | { readonly srgb: Vector; readonly alpha: number }
  | { readonly l: number; readonly c: number; readonly h: number; readonly alpha: number };

const multiply = (m: Matrix, [x, y, z]: Vector): Vector => [
  m[0][0] * x + m[0][1] * y + m[0][2] * z,
  m[1][0] * x + m[1][1] * y + m[1][2] * z,
  m[2][0] * x + m[2][1] * y + m[2][2] * z,
];

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

// ---------------------------------------------------------------------------
// The CSS package's math, statement for statement.

function oklabToLinearSrgb(L: number, a: number, b: number): Vector {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: Vector) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const clip01 = (v: number) => Math.min(1, Math.max(0, v));
const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

type Strategy = "clip" | "chroma";

function oklchToLinear(l: number, c: number, h: number, strategy: Strategy): Vector {
  const lab = (cc: number) => oklabToLinearSrgb(l, cc * Math.cos(toRad(h)), cc * Math.sin(toRad(h)));
  let rgb = lab(c);
  if (!inGamut(rgb) && strategy === "chroma") {
    let lo = 0;
    let hi = c;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lab(mid))) lo = mid;
      else hi = mid;
    }
    rgb = lab(lo);
  }
  return [clip01(rgb[0]), clip01(rgb[1]), clip01(rgb[2])];
}

const linearOf = (colour: Colour, strategy: Strategy): Vector =>
  "srgb" in colour ? colour.srgb : oklchToLinear(colour.l, colour.c, colour.h, strategy);

function over(fg: Vector, alpha: number, bg: Vector): Vector {
  if (alpha >= 1) return fg;
  const mix = (i: 0 | 1 | 2) => decode(encode(fg[i]) * alpha + encode(bg[i]) * (1 - alpha));
  return [mix(0), mix(1), mix(2)];
}

const luminance = ([r, g, b]: Vector) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function ratioOfLinear(a: Vector, b: Vector): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG relative luminance (alpha ignored): which of two colours is lighter. */
export function relativeLuminance(colour: Colour): number {
  return luminance(linearOf(colour, "clip"));
}

/** WCAG contrast of `fg` on `bg`, with the opaque `backdrop` under a translucent `bg`; the worse of both gamut mappings. */
export function contrastRatio(fg: Colour, bg: Colour, backdrop: Colour): number {
  let worst = Infinity;
  for (const strategy of ["clip", "chroma"] as const) {
    const base = linearOf(backdrop, strategy);
    const bgLinear = over(linearOf(bg, strategy), bg.alpha, base);
    const fgLinear = over(linearOf(fg, strategy), fg.alpha, bgLinear);
    worst = Math.min(worst, ratioOfLinear(fgLinear, bgLinear));
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Other spaces, by way of CIE XYZ (D65) into OKLCH. Matrices from CSS Color 4.

const LINEAR_SRGB_TO_XYZ: Matrix = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const LINEAR_P3_TO_XYZ: Matrix = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
];
const D50_TO_D65: Matrix = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const XYZ_TO_LMS: Matrix = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB: Matrix = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

function oklabToOklch([l, a, b]: Vector, alpha: number): Colour {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h, alpha };
}

function xyzToOklch(xyz: Vector, alpha: number): Colour {
  const [l, m, s] = multiply(XYZ_TO_LMS, xyz);
  return oklabToOklch(multiply(LMS_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]), alpha);
}

function labToXyzD65(L: number, a: number, b: number): Vector {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const f1 = (L + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const x = f0 ** 3 > epsilon ? f0 ** 3 : (116 * f0 - 16) / kappa;
  const y = L > kappa * epsilon ? f1 ** 3 : L / kappa;
  const z = f2 ** 3 > epsilon ? f2 ** 3 : (116 * f2 - 16) / kappa;
  return multiply(D50_TO_D65, [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]]);
}

const signedDecode = (v: number) => Math.sign(v) * decode(Math.abs(v));

/** sRGB channels (0–1, gamma-encoded): exact when in gamut, else OKLCH so the gamut mappings apply. */
function fromEncodedSrgb(channels: Vector, alpha: number): Colour {
  const linear: Vector = [signedDecode(channels[0]), signedDecode(channels[1]), signedDecode(channels[2])];
  return inGamut(linear) ? { srgb: linear, alpha } : xyzToOklch(multiply(LINEAR_SRGB_TO_XYZ, linear), alpha);
}

// ---------------------------------------------------------------------------
// Parsing

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/;
const ANGLE_UNITS: { readonly [unit: string]: number } = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/** A channel: `none` is 0, a percentage is a share of `percent`, an angle converts to degrees. Undefined when malformed. */
function channel(text: string, percent: number, angle = false): number | undefined {
  if (text === "none") return 0;
  if (text.endsWith("%")) {
    const body = text.slice(0, -1);
    return NUMBER.test(body) ? (Number(body) / 100) * percent : undefined;
  }
  if (angle) {
    const unit = /[a-z]+$/.exec(text)?.[0];
    if (unit !== undefined) {
      const scale = ANGLE_UNITS[unit];
      const body = text.slice(0, -unit.length);
      return scale !== undefined && NUMBER.test(body) ? Number(body) * scale : undefined;
    }
  }
  return NUMBER.test(text) ? Number(text) : undefined;
}

/** A function's channels and alpha: space- or comma-separated, `/ alpha` or a fourth comma value. */
function splitArguments(body: string): { readonly parts: readonly string[]; readonly alpha: string | undefined } | undefined {
  const [main, alpha, extra] = body.split("/").map((part) => part.trim());
  if (extra !== undefined || main === undefined) return undefined;
  const parts = main.includes(",") ? main.split(",").map((part) => part.trim()) : main.split(/\s+/);
  if (parts.length === 4 && alpha === undefined && main.includes(",")) return { parts: parts.slice(0, 3), alpha: parts[3] };
  return parts.length === 3 ? { parts, alpha } : undefined;
}

const hexByte = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16) / 255;

function parseHex(hex: string): Colour | undefined {
  if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return undefined;
  const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return { srgb: [decode(hexByte(full, 0)), decode(hexByte(full, 2)), decode(hexByte(full, 4))], alpha: full.length === 8 ? hexByte(full, 6) : 1 };
}

function hslToSrgb(h: number, s: number, l: number): Vector {
  const hue = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

type Channels = readonly [number, number, number];

/** Per function: each channel's percentage reference and whether it is a hue, and how its channels become a colour. */
const FUNCTIONS: {
  readonly [name: string]: { readonly percent: Channels; readonly hue?: 0 | 2; readonly make: (v: Channels, alpha: number) => Colour };
} = {
  rgb: { percent: [255, 255, 255], make: ([r, g, b], alpha) => fromEncodedSrgb([r / 255, g / 255, b / 255], alpha) },
  hsl: { percent: [1, 100, 100], hue: 0, make: ([h, s, l], alpha) => fromEncodedSrgb(hslToSrgb(h, s / 100, l / 100), alpha) },
  oklch: { percent: [1, 0.4, 1], hue: 2, make: ([l, c, h], alpha) => ({ l, c, h, alpha }) },
  oklab: { percent: [1, 0.4, 0.4], make: (lab, alpha) => oklabToOklch(lab, alpha) },
  lab: { percent: [100, 125, 125], make: ([l, a, b], alpha) => xyzToOklch(labToXyzD65(l, a, b), alpha) },
  lch: {
    percent: [100, 150, 1],
    hue: 2,
    make: ([l, c, h], alpha) => xyzToOklch(labToXyzD65(l, c * Math.cos(toRad(h)), c * Math.sin(toRad(h))), alpha),
  },
};

const ALIASES: { readonly [name: string]: string } = { rgba: "rgb", hsla: "hsl" };

/** `color(<space> …)`: the predefined spaces a browser serialises to, as XYZ (D65). */
const COLOR_SPACES: { readonly [space: string]: (v: Channels) => Vector } = {
  srgb: (v) => multiply(LINEAR_SRGB_TO_XYZ, [signedDecode(v[0]), signedDecode(v[1]), signedDecode(v[2])]),
  "srgb-linear": (v) => multiply(LINEAR_SRGB_TO_XYZ, v),
  "display-p3": (v) => multiply(LINEAR_P3_TO_XYZ, [signedDecode(v[0]), signedDecode(v[1]), signedDecode(v[2])]),
  xyz: (v) => v,
  "xyz-d65": (v) => v,
  "xyz-d50": (v) => multiply(D50_TO_D65, v),
};

function parseAlpha(text: string | undefined): number | undefined {
  if (text === undefined) return 1;
  const alpha = channel(text, 1);
  return alpha === undefined ? undefined : Math.min(1, Math.max(0, alpha));
}

function parseColorFunction(body: string): Colour | undefined {
  const [space, ...rest] = body.trim().split(/\s+/);
  const toXyz = space === undefined ? undefined : COLOR_SPACES[space];
  const args = splitArguments(rest.join(" "));
  if (toXyz === undefined || args === undefined) return undefined;
  const values = args.parts.map((part) => channel(part, 1));
  const alpha = parseAlpha(args.alpha);
  if (values.some((value) => value === undefined) || alpha === undefined) return undefined;
  const v = values as unknown as Channels;
  return space === "srgb" ? fromEncodedSrgb(v, alpha) : xyzToOklch(toXyz(v), alpha);
}

/**
 * A colour from its CSS text, or undefined when this module cannot read it
 * (a keyword other than `transparent`, `var()`, an unsupported space).
 */
export function parseColour(text: string): Colour | undefined {
  const s = text.trim().toLowerCase();
  if (s === "transparent") return { srgb: [0, 0, 0], alpha: 0 };
  if (s.startsWith("#")) return parseHex(s.slice(1));
  const call = /^([a-z-]+)\(([^()]*)\)$/.exec(s);
  if (call === null) return undefined;
  const [, rawName = "", body = ""] = call;
  if (rawName === "color") return parseColorFunction(body);
  const fn = FUNCTIONS[ALIASES[rawName] ?? rawName];
  const args = splitArguments(body);
  if (fn === undefined || args === undefined) return undefined;
  const values = args.parts.map((part, index) => channel(part, fn.percent[index as 0 | 1 | 2], fn.hue === index));
  const alpha = parseAlpha(args.alpha);
  if (values.some((value) => value === undefined) || alpha === undefined) return undefined;
  return fn.make(values as unknown as Channels, alpha);
}
