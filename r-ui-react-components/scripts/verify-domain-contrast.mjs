#!/usr/bin/env node
// Asserts this package's domain TEXT and MARK colours stay legible on the
// contract's surfaces, in every theme the CSS package ships.
//
// The CSS package's contrast gate measures the contract's own pairs; it cannot
// see the colours declared here (knowledge runs one way). This is the same
// measurement for the domain half:
//   - text-safe colours (trend good/bad, fg-serious, fg-stale) >= 4.5:1 on the
//     canvas and every surface 0..3;
//   - status marks (status-serious, status-stale) >= 3:1 on the same;
//   - each status text on its own subtle BG >= 4.5:1;
//   - each on-fill text (fg-on-serious, fg-on-stale) on its own MARK >= 4.5:1,
//     the mark used as a solid fill (a badge, a selected chip).
// Each theme is measured with ITS scheme's half of every pair (plus any pair
// the theme overrides by name). Themes are discovered (lib/themes.mjs); the
// default `:root` is always among them, so this cannot pass vacuously.
//
// NOT measured: series and sequential marks. Their job is identity and
// magnitude, gated by verify:series-palette; light steps below 3:1 rely on the
// relief rule (direct labels or a table view), a component obligation.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contrastRatio, oklchToLinearSrgb, parseOklch } from "./lib/color.mjs";
import { readBlocks } from "./lib/css.mjs";
import { discoverThemes, resolveValue } from "./lib/themes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const own = new Map();
for (const b of readBlocks(readFileSync(join(ROOT, "src", "tokens.css"), "utf8"))) {
  if (b.prelude === ":root") for (const d of b.decls) own.set(d.name, d.value);
}

const SURFACES = ["--C-CANVAS", "--C-SURFACE-0", "--C-SURFACE-1", "--C-SURFACE-2", "--C-SURFACE-3"];
const TEXT = ["TREND-GOOD", "TREND-BAD", "TEXT-SERIOUS", "TEXT-STALE"];
const MARKS = ["STATUS-SERIOUS", "STATUS-STALE"];
const ON_BG = [
  ["TEXT-SERIOUS", "STATUS-SERIOUS-BG"],
  ["TEXT-STALE", "STATUS-STALE-BG"],
  ["TEXT-ON-SERIOUS", "STATUS-SERIOUS"],
  ["TEXT-ON-STALE", "STATUS-STALE"],
];

const themes = discoverThemes();
const problems = [];
const rows = [];

if (themes.length === 0) {
  problems.push("no theme found in @batthewz/r-ui-css (nothing declares --SCHEME-DARK); nothing was measured.");
}

for (const theme of themes) {
  const half = theme.scheme === "dark" ? "DARK" : "LIGHT";
  const colour = (name) => {
    const value = resolveValue(theme.own.get(name) ?? own.get(name) ?? theme.decls.get(name) ?? "", theme.decls);
    const lch = value && parseOklch(value);
    if (!lch) {
      problems.push(`${theme.label}  ${name}: cannot read \`${value}\` as a plain oklch() colour.`);
      return null;
    }
    return oklchToLinearSrgb(lch);
  };
  const domain = (base) => colour(`--C-${base}-${half}`);

  let worstText = Infinity;
  let worstMark = Infinity;
  const surfaces = SURFACES.map((s) => [s, colour(s)]).filter(([, c]) => c);
  for (const [base, floor] of [...TEXT.map((t) => [t, 4.5]), ...MARKS.map((m) => [m, 3])]) {
    const fg = domain(base);
    if (!fg) continue;
    for (const [surface, bg] of surfaces) {
      const ratio = contrastRatio(fg, bg);
      if (floor === 4.5) worstText = Math.min(worstText, ratio);
      else worstMark = Math.min(worstMark, ratio);
      if (ratio < floor) {
        problems.push(`${theme.label}  --C-${base}-${half} on ${surface}: ${ratio.toFixed(2)}:1 < ${floor}:1`);
      }
    }
  }
  for (const [text, bg] of ON_BG) {
    const [fg, back] = [domain(text), domain(bg)];
    if (!fg || !back) continue;
    const ratio = contrastRatio(fg, back);
    worstText = Math.min(worstText, ratio);
    if (ratio < 4.5) problems.push(`${theme.label}  --C-${text}-${half} on --C-${bg}-${half}: ${ratio.toFixed(2)}:1 < 4.5:1`);
  }
  rows.push(`  ${theme.label} [${theme.scheme}]  worst text ${worstText.toFixed(2)}:1  worst mark ${worstMark.toFixed(2)}:1`);
}

if (problems.length > 0) {
  console.error(
    `verify:domain-contrast — ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n\n` +
      "Move the failing half's L away from the surface (darker on light, lighter on dark), hold\n" +
      "its hue, and re-run. A theme can also override the pair by name.",
  );
  process.exit(1);
}
console.log(`verify:domain-contrast — OK (${themes.length} theme(s))\n${rows.join("\n")}`);
