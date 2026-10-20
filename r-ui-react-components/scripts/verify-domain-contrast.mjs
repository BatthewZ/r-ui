#!/usr/bin/env node
// Asserts this package's domain TEXT and MARK colours stay legible on the
// contract's surfaces, in every theme the CSS package ships.
//
// The CSS package's contrast gate measures the contract's own pairs; it cannot
// see the colours declared here (knowledge runs one way). This is the same
// measurement for the domain half:
//   - text-safe colours (trend good/bad, fg-serious, fg-stale) >= 4.5:1 on the
//     canvas and every surface 0..3;
//   - marks (status-serious, status-stale, the rating fill) >= 3:1 on the same;
//   - each status text on its own subtle BG >= 4.5:1;
//   - each on-fill text (fg-on-serious, fg-on-stale) on its own MARK >= 4.5:1,
//     the mark used as a solid fill (a badge, a selected chip);
//   - every code syntax role (`--color-code-*` in @theme, discovered, never
//     listed) >= 4.5:1 on the canvas and every surface 0..3, which includes the
//     CodeBlock's own surface and its highlighted-line band. A role that is a
//     pair is measured by its scheme's half; a role that aliases a contract
//     text role is resolved in the theme, so the alias is measured too.
// And the density rule for this package's domain sizes: where `:root` declares
// per-density named values (`--CHART-H-COMFORTABLE`), no theme block may declare
// the selected name (`--CHART-H`). Only `[data-density]` selects it; a theme's
// `:root[data-theme]` outranks that selection on `<html>`, so the page would
// lose its density. The CSS package's theme rules hold the same for its own
// names; they cannot know these (knowledge runs one way).
//
// Each theme is measured with ITS scheme's half of every pair (plus any pair
// the theme overrides by name). Themes are discovered (lib/themes.mjs); the
// default `:root` is always among them, so this cannot pass vacuously; zero
// code roles fails too.
//
// Usage: node scripts/verify-domain-contrast.mjs [--theme <file>]... [--tokens <file>]
//   --theme   measure a consumer's theme file(s) instead of the shipped themes:
//             each block declaring `--SCHEME-DARK` is a theme, over the CSS
//             package's defaults. Installed, the same check is the
//             `r-ui-domain-contrast` bin: `npx r-ui-domain-contrast --theme src/brand.css`.
//   --tokens  a tampered copy of src/tokens.css (the gate's own test).
//
// NOT measured: series and sequential marks. Their job is identity and
// magnitude, gated by verify:series-palette; light steps below 3:1 rely on the
// relief rule (direct labels or a table view), a component obligation.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { contrastRatio, oklchToLinearSrgb, parseOklch } from "./lib/color.mjs";
import { readBlocks } from "./lib/css.mjs";
import { ALIAS, BLEND } from "./lib/domain-pairs.mjs";
import { PKG, pathArg, pathArgs } from "./lib/gate.mjs";
import { cssPackageSrc, discoverThemes, resolveValue } from "./lib/themes.mjs";

const TOKENS = pathArg("--tokens", join(PKG, "src", "tokens.css"));
const own = new Map();
// Code roles: `--color-code-x` -> the pair base (`C-CODE-X`) or the aliased contract name.
const codeRoles = [];
for (const b of readBlocks(readFileSync(TOKENS, "utf8"))) {
  if (b.prelude === ":root" && b.parents.length === 0) for (const d of b.decls) own.set(d.name, d.value);
  if (!b.prelude.startsWith("@theme")) continue;
  for (const d of b.decls) {
    if (!d.name.startsWith("--color-code-")) continue;
    const pair = BLEND.exec(d.value);
    const alias = ALIAS.exec(d.value);
    codeRoles.push({ role: d.name.slice("--color-".length), pair: pair?.[1], alias: alias?.[1], value: d.value });
  }
}

// Domain sizes a theme tunes per density but never selects. Zero fails: the rule would hold vacuously.
const densitySizes = [...own.keys()].filter((n) => n.endsWith("-COMFORTABLE")).map((n) => n.slice(0, -"-COMFORTABLE".length));

const SURFACES = ["--C-CANVAS", "--C-SURFACE-0", "--C-SURFACE-1", "--C-SURFACE-2", "--C-SURFACE-3"];
const TEXT = ["TREND-GOOD", "TREND-BAD", "TEXT-SERIOUS", "TEXT-STALE"];
const MARKS = ["STATUS-SERIOUS", "STATUS-STALE", "RATING"];
const ON_BG = [
  ["TEXT-SERIOUS", "STATUS-SERIOUS-BG"],
  ["TEXT-STALE", "STATUS-STALE-BG"],
  ["TEXT-ON-SERIOUS", "STATUS-SERIOUS"],
  ["TEXT-ON-STALE", "STATUS-STALE"],
];

const themeFiles = pathArgs("--theme");
const missing = themeFiles.filter((f) => !existsSync(f));
const problems = missing.map((f) => `--theme ${relative(process.cwd(), f)}: no such file.`);
const themes = missing.length ? [] : discoverThemes({ files: themeFiles });
const rows = [];

if (!cssPackageSrc()) {
  problems.push("@batthewz/r-ui-css is not installed (no node_modules/@batthewz/r-ui-css/src here or above); nothing was measured.");
} else if (themes.length === 0 && missing.length === 0) {
  problems.push(
    themeFiles.length
      ? `no theme found in ${themeFiles.map((f) => relative(process.cwd(), f)).join(", ")} (a theme block declares --SCHEME-DARK); nothing was measured.`
      : "no theme found in @batthewz/r-ui-css (nothing declares --SCHEME-DARK); nothing was measured.",
  );
}
if (densitySizes.length === 0) problems.push("no per-density domain size (`--X-COMFORTABLE` on :root) found; the density rule was not checked.");
if (codeRoles.length === 0) problems.push("no `--color-code-*` role found in @theme; the code palette was not measured.");
for (const r of codeRoles) {
  if (!r.pair && !r.alias) {
    problems.push(`--color-${r.role}: \`${r.value}\` is neither a LIGHT/DARK blend nor an alias of a contract role.`);
  }
}

for (const theme of themes) {
  for (const name of densitySizes) {
    if (theme.own.has(name)) {
      problems.push(`${theme.label}  sets ${name}, the selected density name: set ${name}-COMFORTABLE / ${name}-COMPACT instead.`);
    }
  }
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

  const surfaces = SURFACES.map((s) => [s, colour(s)]).filter(([, c]) => c);
  /** The worst ratio of `fg` across the surfaces, each one under `floor` reported as `what`. */
  const onSurfaces = (fg, floor, what) => {
    let worst = Infinity;
    for (const [surface, bg] of surfaces) {
      const ratio = contrastRatio(fg, bg);
      worst = Math.min(worst, ratio);
      if (ratio < floor) problems.push(`${theme.label}  ${what} on ${surface}: ${ratio.toFixed(2)}:1 < ${floor}:1`);
    }
    return worst;
  };

  let worstText = Infinity;
  let worstMark = Infinity;
  for (const base of TEXT) {
    const fg = domain(base);
    if (fg) worstText = Math.min(worstText, onSurfaces(fg, 4.5, `--C-${base}-${half}`));
  }
  for (const base of MARKS) {
    const fg = domain(base);
    if (fg) worstMark = Math.min(worstMark, onSurfaces(fg, 3, `--C-${base}-${half}`));
  }
  for (const [text, bg] of ON_BG) {
    const [fg, back] = [domain(text), domain(bg)];
    if (!fg || !back) continue;
    const ratio = contrastRatio(fg, back);
    worstText = Math.min(worstText, ratio);
    if (ratio < 4.5) problems.push(`${theme.label}  --C-${text}-${half} on --C-${bg}-${half}: ${ratio.toFixed(2)}:1 < 4.5:1`);
  }
  let worstCode = Infinity;
  for (const r of codeRoles) {
    const name = r.pair ? `--${r.pair}-${half}` : r.alias;
    if (!name) continue;
    const fg = colour(name);
    if (fg) worstCode = Math.min(worstCode, onSurfaces(fg, 4.5, `code role ${r.role} (${name})`));
  }
  rows.push(
    `  ${theme.label} [${theme.scheme}]  worst text ${worstText.toFixed(2)}:1  worst mark ${worstMark.toFixed(2)}:1  worst code role ${worstCode.toFixed(2)}:1`,
  );
}

if (problems.length > 0) {
  console.error(
    `verify:domain-contrast — ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n\n` +
      "Move the failing half's L away from the surface (darker on light, lighter on dark), hold\n" +
      "its hue, and re-run. A theme can also override the pair by name. A theme tunes a domain\n" +
      "size through its per-density names and never sets the selected one.",
  );
  process.exit(1);
}
console.log(`verify:domain-contrast — OK (${themes.length} theme(s), ${codeRoles.length} code role(s), ${densitySizes.length} density size(s))\n${rows.join("\n")}`);
