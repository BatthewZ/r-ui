// OKLCH -> sRGB -> WCAG 2.x contrast. Dependency-free.
//
// Out-of-gamut colours are measured pessimistically: both per-channel clipping and
// constant-L/H chroma reduction are tried and the caller takes the worse ratio, so the
// result holds whichever gamut mapping a browser uses.

const toRad = (d) => (d * Math.PI) / 180;

function oklabToLinearSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const clip01 = (v) => Math.min(1, Math.max(0, v));
const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Linear sRGB for an OKLCH colour, by one of two gamut strategies. */
export function oklchToLinear({ l, c, h }, strategy = "clip") {
  const lab = (cc) => oklabToLinearSrgb(l, cc * Math.cos(toRad(h)), cc * Math.sin(toRad(h)));
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
  return rgb.map(clip01);
}

export function isInGamut({ l, c, h }) {
  return inGamut(oklabToLinearSrgb(l, c * Math.cos(toRad(h)), c * Math.sin(toRad(h))));
}

const num = (s, pctScale) => {
  s = s.trim();
  if (s === "none") return 0;
  if (s.endsWith("%")) return (parseFloat(s) / 100) * pctScale;
  if (s.endsWith("deg")) return parseFloat(s);
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`not a number: ${s}`);
  return n;
};

/** Parse `oklch(L C H [/ A])`, `#rgb[a]`/`#rrggbb[aa]`, `transparent`. Returns {l,c,h,alpha} or {srgb,alpha}. */
export function parseColor(str) {
  const s = str.trim().toLowerCase();
  if (s === "transparent") return { srgb: [0, 0, 0], alpha: 0 };
  let m = /^oklch\(\s*([^)]*)\)$/.exec(s);
  if (m) {
    const [main, alphaPart] = m[1].split("/");
    const parts = main.trim().split(/\s+/);
    if (parts.length !== 3) throw new Error(`bad oklch(): ${str}`);
    return {
      l: num(parts[0], 1),
      c: num(parts[1], 0.4),
      h: num(parts[2], 1),
      alpha: alphaPart === undefined ? 1 : num(alphaPart, 1),
    };
  }
  m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let hex = m[1];
    if (hex.length <= 4) hex = [...hex].map((x) => x + x).join("");
    const v = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return { srgb: [decode(v(0)), decode(v(2)), decode(v(4))], alpha: hex.length === 8 ? v(6) : 1 };
  }
  throw new Error(`unsupported colour (use oklch()): ${str}`);
}

function linearOf(color, strategy) {
  return color.srgb ?? oklchToLinear(color, strategy);
}

/** Composite fg (with alpha) over an opaque bg, in gamma-encoded sRGB as browsers do. */
function over(fgLin, alpha, bgLin) {
  if (alpha >= 1) return fgLin;
  return fgLin.map((v, i) => decode(encode(v) * alpha + encode(bgLin[i]) * (1 - alpha)));
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** WCAG relative luminance of a colour (alpha ignored): which of two is lighter. */
export function relativeLuminance(str) {
  return luminance(linearOf(parseColor(str), "clip"));
}

export function ratioOfLinear(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG contrast of fg on bg. `backdrop` (opaque) sits under a translucent bg.
 * Returns { ratio, outOfGamut } where ratio is the worse of both gamut strategies.
 */
export function contrast(fgStr, bgStr, backdropStr = "oklch(1 0 0)") {
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);
  const backdrop = parseColor(backdropStr);
  let worst = Infinity;
  for (const strategy of ["clip", "chroma"]) {
    const base = linearOf(backdrop, strategy);
    const bgLin = over(linearOf(bg, strategy), bg.alpha, base);
    const fgLin = over(linearOf(fg, strategy), fg.alpha, bgLin);
    worst = Math.min(worst, ratioOfLinear(fgLin, bgLin));
  }
  const oog = [fg, bg].some((c) => c.srgb === undefined && !isInGamut(c));
  return { ratio: worst, outOfGamut: oog };
}
