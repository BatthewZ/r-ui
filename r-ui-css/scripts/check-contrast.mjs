#!/usr/bin/env node
// Contrast check: every contract pair, in the default theme and every theme file.
// Usage: node scripts/check-contrast.mjs [--pkg <dir>] [extra-theme.css ...]
import { isMain, parseArgs } from "./lib/cli.mjs";
import { contrast, relativeLuminance } from "./lib/color.mjs";
import { resolveVars } from "./lib/css.mjs";
import { allThemes } from "./lib/tokens.mjs";

const SURFACES = ["--C-CANVAS", "--C-SURFACE-0", "--C-SURFACE-1", "--C-SURFACE-2", "--C-SURFACE-3"];
const STATUSES = ["ERROR", "SUCCESS", "WARNING", "INFO"];

/** Matrix rows: each fg against every surface. */
export const SURFACE_PAIRS = [
  ...["PRIMARY", "SECONDARY", "MUTED", "ACCENT", ...STATUSES].map((t) => ({ fg: `--C-TEXT-${t}`, min: 4.5, kind: "text" })),
  ...STATUSES.map((s) => ({ fg: `--C-STATUS-${s}`, min: 3, kind: "mark" })),
  { fg: "--C-ACCENT", min: 3, kind: "mark" },
  { fg: "--C-FOCUS", min: 3, kind: "focus" },
  { fg: "--C-BORDER-STRONG", min: 3, kind: "control edge" },
];

/** Fill pairs: fg on a specific bg. */
export const FILL_PAIRS = [
  ...["PRIMARY", "PRIMARY-HOVER", "PRIMARY-ACTIVE"].map((bg) => ({ fg: "--C-TEXT-ON-PRIMARY", bg: `--C-${bg}`, min: 4.5 })),
  ...["ACCENT", "ACCENT-HOVER"].map((bg) => ({ fg: "--C-TEXT-ON-ACCENT", bg: `--C-${bg}`, min: 4.5 })),
  { fg: "--C-TEXT-ON-SELECTION", bg: "--C-SELECTION", min: 4.5 },
  { fg: "--C-TEXT-SECONDARY", bg: "--C-SELECTION", min: 4.5 },
  { fg: "--C-TEXT-INVERSE", bg: "--C-TEXT-PRIMARY", min: 4.5 },
  ...STATUSES.flatMap((s) => [
    { fg: `--C-TEXT-ON-${s}`, bg: `--C-STATUS-${s}`, min: 4.5 },
    { fg: `--C-TEXT-${s}`, bg: `--C-STATUS-${s}-BG`, min: 4.5 },
    { fg: "--C-TEXT-PRIMARY", bg: `--C-STATUS-${s}-BG`, min: 4.5 },
    { fg: `--C-STATUS-${s}`, bg: `--C-STATUS-${s}-BG`, min: 3 },
  ]),
];

/** A dark theme's text must be lighter than its canvas, a light theme's darker. */
function schemeCoherence(theme, get) {
  const r = { fg: "--C-TEXT-PRIMARY", bg: "--C-CANVAS", kind: "scheme", min: 0, ratio: NaN, pass: false };
  try {
    const dark = get("--SCHEME-DARK") === "1";
    const lighter = relativeLuminance(get("--C-TEXT-PRIMARY")) > relativeLuminance(get("--C-CANVAS"));
    r.pass = dark === lighter;
    if (!r.pass) r.error = `--SCHEME-DARK is ${dark ? 1 : 0} but text is ${lighter ? "lighter" : "darker"} than the canvas (partial theme?)`;
  } catch (e) {
    r.error = e.message;
  }
  return r;
}

const short = (t) => t.replace("--C-", "");

export function measureTheme(theme) {
  const results = [];
  const get = (name) => resolveVars(`var(${name})`, theme.tokens);
  const canvas = get("--C-CANVAS");
  const measure = (fg, bg, min, kind) => {
    try {
      const { ratio, outOfGamut } = contrast(get(fg), get(bg), canvas);
      results.push({ fg, bg, min, kind, ratio, outOfGamut, pass: ratio >= min });
    } catch (e) {
      results.push({ fg, bg, min, kind, ratio: NaN, error: e.message, pass: false });
    }
  };
  for (const p of SURFACE_PAIRS) for (const bg of SURFACES) measure(p.fg, bg, p.min, p.kind);
  for (const p of FILL_PAIRS) measure(p.fg, p.bg, p.min, "fill");
  results.push(schemeCoherence(theme, get));
  return results;
}

function fmt(r) {
  if (r.error) return "  ERR ";
  const s = r.ratio.toFixed(2).padStart(6);
  return `${s}${r.pass ? (r.outOfGamut ? "*" : " ") : "!"}`;
}

export function report(themes, log = console.log) {
  let failures = 0;
  let total = 0;
  for (const theme of themes) {
    const results = measureTheme(theme);
    total += results.length;
    log(`\n${theme.name}`);
    log(`  ${"surface pairs".padEnd(22)} ${"min".padStart(4)}  ${SURFACES.map((s) => short(s).padStart(10)).join("")}`);
    for (const p of SURFACE_PAIRS) {
      const row = results.filter((r) => r.fg === p.fg && r.kind === p.kind);
      log(`  ${short(p.fg).padEnd(22)} ${String(p.min).padStart(4)}  ${row.map((r) => fmt(r).padStart(10)).join("")}`);
    }
    log(`  fill pairs`);
    for (const r of results.filter((x) => x.kind === "fill")) {
      log(`  ${`${short(r.fg)} on ${short(r.bg)}`.padEnd(44)} ${String(r.min).padStart(4)}  ${fmt(r)}`);
    }
    for (const r of results.filter((x) => !x.pass)) {
      failures++;
      log(`  FAIL ${short(r.fg)} on ${short(r.bg)}: ${r.error ?? `${r.ratio.toFixed(2)} < ${r.min}`}`);
    }
  }
  log(`\n${total - failures}/${total} pairs pass across ${themes.length} theme(s). "!" = fail, "*" = out of sRGB gamut (worst mapping measured).`);
  return failures;
}

function main(argv) {
  const { pkg, extra } = parseArgs(argv);
  const failures = report(allThemes(pkg, extra));
  if (failures) {
    console.error(`contrast: ${failures} pair(s) below their minimum`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main(process.argv.slice(2));
