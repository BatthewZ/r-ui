#!/usr/bin/env node
// Asserts the categorical series palette (`--C-SERIES-1..8` in src/tokens.css)
// stays tellable apart, in BOTH schemes, for full-colour readers and under
// protanopia and deuteranopia.
//
// WHY A GATE AND NOT A UNIT TEST
//
// The requirement ("eight series side by side are distinguishable") is a
// property of colour values in a stylesheet. vitest runs with no CSS, so no
// test can read it; a retune of one step (here, or a theme overriding a pair by
// name) can silently fold two series into one colour.
//
// WHAT IT MEASURES (the dataviz method this palette was validated with)
//
// Per scheme, the LIGHT halves and the DARK halves as separate palettes:
//   1. Lightness band: L in [0.43, 0.77] light, [0.48, 0.67] dark.
//   2. Chroma floor: C >= 0.10, or a hue reads as grey and stops doing identity.
//   3. Adjacent pairs (stacks, bars, lines: only neighbours touch, and
//      assignment never skips a slot), distance = OKLab Euclidean x100:
//        - normal vision >= 15 (hard);
//        - protanopia/deuteranopia (Machado 2009, severity 1) >= 6 (hard),
//          < 8 reported as a WARN (legal only with secondary encoding).
//   4. All pairs of the first THREE slots (scatter / small multiples, where any
//      two marks can neighbour): same floors. Past three such forms fold to
//      "Other" or facet; that cap is a documented rule, not a palette defect.
//
// THEMES. A theme may override a pair by name. Every `--SCHEME-DARK`-declaring
// block found under @batthewz/r-ui-css/src is measured with its own overrides
// on top of the defaults, discovered by reading files, never by a list of
// names (example themes have no privileges, including in gates).
//
// Usage: node scripts/verify-series-palette.mjs [--theme <file>]... [--tokens <file>]
//   --theme   measure a consumer's theme file(s) instead of the shipped themes
//             (each block declaring `--SCHEME-DARK`, over the CSS package's defaults).
//   --tokens  a tampered copy of src/tokens.css (the gate's own test).
//
// NOT COVERED, stated so the blind spot is not silent:
//   - Contrast of a series mark against the surface. The light steps for
//     magenta, yellow and aqua sit below 3:1 on a near-white surface by design;
//     the relief rule applies (visible direct labels or a table view). This is
//     a component obligation (legend + labels + table), not a palette check.
//   - Tritanopia (rare); measured and printed, not gated.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { CVD, deltaE, linearSrgbToOklab, oklchToLinearSrgb, oklchToOklab, parseOklch, simulate } from "./lib/color.mjs";
import { readBlocks } from "./lib/css.mjs";
import { PKG, pathArg, pathArgs } from "./lib/gate.mjs";
import { discoverThemes } from "./lib/themes.mjs";

const TOKENS = pathArg("--tokens", join(PKG, "src", "tokens.css"));
const TOKENS_LABEL = relative(PKG, TOKENS);
const THEME_FILES = pathArgs("--theme");
const SERIES_HALF = /^--C-SERIES-\d+-(LIGHT|DARK)$/;
const SLOTS = 8;
const BANDS = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1;
const NORMAL_FLOOR = 15;
const CVD_FLOOR = 6;
const CVD_TARGET = 8;
const ALL_PAIRS_SLOTS = 3;

const problems = [];
const warnings = [];
const lines = [];

/** `--C-SERIES-n-LIGHT|DARK` values declared in a set of blocks, later wins. */
function seriesDecls(blocks) {
  const out = new Map();
  for (const b of blocks) {
    for (const d of b.decls) if (SERIES_HALF.test(d.name)) out.set(d.name, d);
  }
  return out;
}

const tokenBlocks = readBlocks(readFileSync(TOKENS, "utf8")).filter((b) => b.prelude === ":root" && b.parents.length === 0);
const base = seriesDecls(tokenBlocks);

for (let i = 1; i <= SLOTS; i += 1) {
  for (const half of ["LIGHT", "DARK"]) {
    if (!base.has(`--C-SERIES-${i}-${half}`)) {
      problems.push(`${TOKENS_LABEL}  --C-SERIES-${i}-${half} is not declared on :root.`);
    }
  }
}

/* ---------------------------------------------- discover theme overrides */

const themes = discoverThemes({ files: THEME_FILES }).map((t) => ({
  label: t.label,
  scheme: t.scheme,
  overrides: new Map(
    [...t.own]
      .filter(([name]) => SERIES_HALF.test(name))
      .map(([name, value]) => [name, { name, value }]),
  ),
}));

/* ---------------------------------------------------------- measurement */

function measure(label, scheme, decls) {
  const palette = [];
  for (let i = 1; i <= SLOTS; i += 1) {
    const name = `--C-SERIES-${i}-${scheme === "dark" ? "DARK" : "LIGHT"}`;
    const decl = decls.get(name);
    if (!decl) return;
    const lch = parseOklch(decl.value);
    if (!lch) {
      problems.push(`${label}  ${name}: \`${decl.value}\` is not a plain oklch(L C H) literal.`);
      return;
    }
    palette.push({ slot: i, name, lch });
  }

  const [lo, hi] = BANDS[scheme];
  for (const p of palette) {
    if (p.lch.L < lo || p.lch.L > hi) {
      problems.push(`${label}  ${p.name}: L ${p.lch.L.toFixed(3)} outside the ${scheme} band [${lo}, ${hi}].`);
    }
    if (p.lch.C < CHROMA_FLOOR) {
      problems.push(`${label}  ${p.name}: C ${p.lch.C.toFixed(3)} below the chroma floor ${CHROMA_FLOOR}.`);
    }
  }

  const views = {
    normal: palette.map((p) => oklchToOklab(p.lch)),
    ...Object.fromEntries(
      Object.entries(CVD).map(([k, m]) => [
        k,
        palette.map((p) => linearSrgbToOklab(simulate(m, oklchToLinearSrgb(p.lch)))),
      ]),
    ),
  };

  const pairs = [];
  for (let i = 0; i < palette.length - 1; i += 1) pairs.push([i, i + 1, "adjacent"]);
  for (let i = 0; i < ALL_PAIRS_SLOTS; i += 1) {
    for (let j = i + 2; j < ALL_PAIRS_SLOTS; j += 1) pairs.push([i, j, "first-three"]);
  }

  const worst = {};
  for (const [view, labs] of Object.entries(views)) {
    let min = { d: Infinity };
    for (const [i, j, kind] of pairs) {
      const d = deltaE(labs[i], labs[j]) * 100;
      if (d < min.d) min = { d, i, j };
      const tag = `${label}  ${scheme} ${view}: series ${i + 1}/${j + 1} (${kind}) ΔE ${d.toFixed(1)}`;
      if (view === "normal" && d < NORMAL_FLOOR) problems.push(`${tag} < ${NORMAL_FLOOR}.`);
      if ((view === "protanopia" || view === "deuteranopia") && d < CVD_FLOOR) {
        problems.push(`${tag} < ${CVD_FLOOR}.`);
      } else if ((view === "protanopia" || view === "deuteranopia") && d < CVD_TARGET) {
        warnings.push(`${tag} in the ${CVD_FLOOR}–${CVD_TARGET} band: secondary encoding required.`);
      }
    }
    worst[view] = `${min.d.toFixed(1)} (${min.i + 1}/${min.j + 1})`;
  }
  lines.push(
    `  ${label} [${scheme}]  worst ΔE  normal ${worst.normal}  protan ${worst.protanopia}  deutan ${worst.deuteranopia}  tritan ${worst.tritanopia} (not gated)`,
  );
}

measure(TOKENS_LABEL, "light", base);
measure(TOKENS_LABEL, "dark", base);
if (THEME_FILES.length > 0 && themes.length === 0) {
  problems.push(`no theme found in ${THEME_FILES.map((f) => relative(process.cwd(), f)).join(", ")} (a theme block declares --SCHEME-DARK).`);
}
for (const theme of themes) {
  if (theme.overrides.size === 0) continue; // identical to the default measured above
  measure(theme.label, theme.scheme, new Map([...base, ...theme.overrides]));
}

if (problems.length > 0) {
  console.error(
    `verify:series-palette — ${problems.length} problem(s):\n` +
      problems.map((p) => `  ${p}`).join("\n") +
      `\n\nRe-step the offending slot within its hue (hold the hue, move L) and re-run.` +
      ` Never re-order to dodge a pair: the order is the safety mechanism.`,
  );
  process.exit(1);
}

const themeNote =
  themes.length === 0
    ? "no themes discovered under @batthewz/r-ui-css/src; defaults measured in both schemes"
    : `${themes.length} theme block(s) discovered, ${themes.filter((t) => t.overrides.size).length} override series`;
console.log(`verify:series-palette — OK (${themeNote})\n${lines.join("\n")}`);
if (warnings.length) console.log(`  WARN:\n${warnings.map((w) => `    ${w}`).join("\n")}`);
