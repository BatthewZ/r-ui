#!/usr/bin/env node
// Theme rules:
//  1. A theme file holds only `:root[data-theme="<file-stem>"]` rules (plus @keyframes).
//     No @media, no @import, no nesting: themes apply at the root only, the viewport
//     never redefines a token, and the axes are the package's job.
//  2. Every theme sets `color-scheme` (light|dark) and a matching `--SCHEME-DARK` (0|1).
//  3. Themes never set a selected density name (`--R-SIZE-3`) or an axis-derived token
//     (`--CONTROL-H`, `--ROW-H`, `--HIT-MIN`, `--ICON`); only per-density NAMED values.
//     Nor a structure token: `--LAYER-*` (stacking order is not a brand lever) or a
//     `--container-*` alias (it points a box utility at its lever; set the lever).
//  4. The template declares every themeable :root token, with the default's value.
//  5. No example theme's name appears anywhere in the package outside its own file.
//  6. No @media (viewport) block in the package declares a custom property.
//  7. Under `@media (forced-colors: active)` the package maps every `--C-*` colour role
//     to a system colour (or a mix of one), so a new role cannot skip forced colors,
//     and sets --SCHEME-DARK from the forced palette (0, or 1 when it is dark).
//  8. No theme declaration is `!important`. The package's own overrides (reduced motion,
//     more contrast, forced colors, print) beat a theme's more specific selector only
//     because they are important and the theme's are not.
//  9. Under `@media print` the package sets, on `:root` and `!important`: every `--C-*`
//     colour role, `color-scheme: light`, `--SCHEME-DARK: 0`, flat shadows, collapsed
//     durations and underlined links. Paper is light whatever the theme.
// Usage: node scripts/check-theme-rules.mjs [--pkg <dir>] [extra-theme.css ...]
import { readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { isMain, parseArgs } from "./lib/cli.mjs";
import { allNodes, listFiles, loadSheet, splitSelectors } from "./lib/css.mjs";
import { THEME_SELECTOR, loadDefaults, pkgPaths, printDecls, readTheme, themeFiles } from "./lib/tokens.mjs";

const AXIS_DERIVED = ["--CONTROL-H", "--ROW-H", "--HIT-MIN", "--ICON", "--MOTION-INLINE-SIGN"];
const STRUCTURE = /^--(LAYER-|container-)/;
const VIEWPORT_MEDIA = /\b(min-|max-)?(width|height|aspect-ratio|orientation)\b/;
const SYSTEM_COLOR = /\b(Canvas|CanvasText|LinkText|VisitedText|ActiveText|ButtonFace|ButtonText|ButtonBorder|Field|FieldText|Highlight|HighlightText|SelectedItem|SelectedItemText|Mark|MarkText|GrayText|AccentColor|AccentColorText)\b/;

/** Names a theme may never set: every X with an X-COMFORTABLE, axis-derived and structure tokens. */
export function forbiddenNames(defaults) {
  const out = new Set(AXIS_DERIVED);
  for (const name of defaults.keys()) {
    const m = /^(--.+)-COMFORTABLE$/.exec(name);
    if (m) out.add(m[1]);
    if (STRUCTURE.test(name)) out.add(name);
  }
  return out;
}

function forbiddenHint(prop) {
  if (AXIS_DERIVED.includes(prop)) return "it belongs to an axis";
  if (prop.startsWith("--container-")) return "it aliases a lever; set the lever (--COLUMN-*, --PAGE-MAX, --MEASURE)";
  if (STRUCTURE.test(prop)) return "stacking is structure, not a brand lever";
  return `set ${prop}-COMFORTABLE / ${prop}-COMPACT instead`;
}

export function checkThemeFile(file, forbidden, { requireStemName = true } = {}) {
  const errors = [];
  const t = readTheme(file);
  for (const n of t.nodes) {
    if (n.type === "at") {
      if (n.name !== "keyframes") errors.push(`@${n.name} is not allowed in a theme file`);
      continue;
    }
    for (const sel of splitSelectors(n.selector)) {
      const m = THEME_SELECTOR.exec(sel);
      if (!m) errors.push(`selector "${sel}" is not :root[data-theme="…"]`);
      else if (requireStemName && m[1] !== t.stem) errors.push(`selector names "${m[1]}" but the file is ${t.stem}.css`);
    }
    if (n.children.length) errors.push(`nested rules inside "${n.selector}"`);
    for (const d of n.decls) {
      if (d.important) errors.push(`${d.prop} is !important: a theme never outranks the package's preference and print overrides`);
    }
  }
  const scheme = t.decls.get("color-scheme");
  const dark = t.decls.get("--SCHEME-DARK");
  if (!scheme) errors.push("missing color-scheme");
  else if (!/^(light|dark)$/.test(scheme)) errors.push(`color-scheme must be exactly light or dark, got "${scheme}"`);
  if (dark === undefined) errors.push("missing --SCHEME-DARK");
  else if (scheme && dark !== (scheme === "dark" ? "1" : "0")) {
    errors.push(`--SCHEME-DARK is ${dark} but color-scheme is ${scheme}`);
  }
  for (const prop of t.decls.keys()) {
    if (forbidden.has(prop)) errors.push(`sets ${prop}: ${forbiddenHint(prop)}`);
  }
  return { name: t.names[0] ?? t.stem, errors };
}

/**
 * Labels for the output. A caller's own theme is named by the path it was given; the
 * package's files by their path inside it, prefixed with its name when run from elsewhere
 * (a consumer's `src/` must not read as the package's).
 */
function labeller(root) {
  let name = basename(root);
  try {
    name = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name ?? name;
  } catch {
    /* no package.json: the folder name will do */
  }
  const inside = resolve(process.cwd()) === root;
  return {
    own: (file) => (inside ? relative(root, file) : `${name}/${relative(root, file)}`),
    caller: (file) => relative(process.cwd(), file),
  };
}

export function checkPackage(pkgDir, extra = []) {
  const { root, template } = pkgPaths(pkgDir);
  const label = labeller(root);
  const defaults = loadDefaults(pkgDir);
  const forbidden = forbiddenNames(defaults);
  const results = [];

  const examples = themeFiles(pkgDir);
  for (const file of themeFiles(pkgDir, extra)) {
    results.push({ label: examples.includes(file) ? label.own(file) : label.caller(file), ...checkThemeFile(file, forbidden) });
  }

  // Template: same structure, plus completeness against the defaults.
  const tpl = checkThemeFile(template, forbidden, { requireStemName: false });
  const tplDecls = readTheme(template).decls;
  const norm = (v) => v.replace(/\s+/g, " ").trim();
  for (const [prop, value] of defaults) {
    if (forbidden.has(prop) || prop === "color-scheme" || !prop.startsWith("--")) continue;
    if (!tplDecls.has(prop)) tpl.errors.push(`template is missing ${prop}`);
    else if (norm(tplDecls.get(prop)) !== norm(value)) {
      tpl.errors.push(`template ${prop} is "${tplDecls.get(prop)}" but the default is "${value}"`);
    }
  }
  results.push({ label: label.own(template), ...tpl });

  // Example names stay inside their own files.
  const nameErrors = [];
  const files = listFiles(root).filter((f) => !/\.(png|jpe?g|webp|gif|ico|woff2?)$/.test(f));
  for (const themeFile of examples) {
    const { names } = readTheme(themeFile);
    for (const name of names) {
      const re = new RegExp(`\\b${name}\\b`, "i");
      for (const f of files) {
        if (f === themeFile) continue;
        if (re.test(readFileSync(f, "utf8"))) nameErrors.push(`example theme name "${name}" appears in ${label.own(f)}`);
      }
    }
  }
  results.push({ label: "example theme names", errors: nameErrors });

  // Viewport media never redefines a token, anywhere in the shipped CSS.
  const vpErrors = [];
  for (const f of files.filter((x) => x.endsWith(".css") && x.includes(`${join(root, "src")}`))) {
    for (const n of allNodes(loadSheet(f))) {
      if (n.type !== "at" || n.name !== "media" || !VIEWPORT_MEDIA.test(n.prelude)) continue;
      const declares = [...allNodes(n.children ?? [])].some((x) => x.decls.some((d) => d.prop.startsWith("--")));
      if (declares) vpErrors.push(`@media ${n.prelude} declares a custom property (${label.own(f)})`);
    }
  }
  results.push({ label: "viewport never redefines a token", errors: vpErrors });

  // Forced colors: every colour role on :root has a system-colour mapping.
  const forced = new Map();
  const forcedScheme = new Map();
  const collect = (nodes, inForced, dark) => {
    for (const n of nodes) {
      const media = n.type === "at" && n.name === "media";
      const here = inForced || (media && /forced-colors:\s*active/.test(n.prelude));
      const darkHere = dark || (media && /prefers-color-scheme:\s*dark/.test(n.prelude));
      if (here && n.type === "rule" && n.selector.trim() === ":root") {
        for (const d of n.decls) {
          if (d.prop === "--SCHEME-DARK") forcedScheme.set(darkHere ? "dark" : "light", d.value.replace(/\s*!important$/, ""));
          else forced.set(d.prop, d.value);
        }
      }
      if (n.children) collect(n.children, here, darkHere);
    }
  };
  collect(loadSheet(pkgPaths(pkgDir).entry), false, false);
  const fcErrors = [];
  if (forcedScheme.get("light") !== "0" || forcedScheme.get("dark") !== "1") {
    fcErrors.push(`--SCHEME-DARK must follow the forced palette (0, and 1 under prefers-color-scheme: dark); found ${JSON.stringify(Object.fromEntries(forcedScheme))}`);
  }
  for (const prop of defaults.keys()) {
    if (!prop.startsWith("--C-")) continue;
    if (!forced.has(prop)) fcErrors.push(`${prop} has no forced-colors mapping`);
    else if (!SYSTEM_COLOR.test(forced.get(prop))) fcErrors.push(`${prop} maps to "${forced.get(prop)}", not a system colour`);
  }
  results.push({ label: "forced colors map every colour role", errors: fcErrors });

  // Print: one light palette over every theme.
  const print = printDecls(pkgDir);
  const prErrors = [];
  const expectPrint = (prop, ok, want) => {
    const d = print.get(prop);
    if (!d) prErrors.push(`${prop} is not set under @media print`);
    else if (!d.important) prErrors.push(`${prop} under @media print is not !important, so a theme outranks it`);
    else if (!ok(d.value)) prErrors.push(`${prop} under @media print is "${d.value}", want ${want}`);
  };
  expectPrint("color-scheme", (v) => v === "light", "light");
  expectPrint("--SCHEME-DARK", (v) => v === "0", "0");
  expectPrint("--LINK-DECORATION", (v) => v === "underline", "underline");
  for (const prop of defaults.keys()) {
    if (prop.startsWith("--C-")) expectPrint(prop, () => true, "a colour");
    if (prop.startsWith("--SHADOW-")) expectPrint(prop, (v) => /^0 0 transparent$/.test(v), "a flat shadow (0 0 transparent)");
    if (prop.startsWith("--DURATION-")) expectPrint(prop, (v) => /^0(\.0*1)?(ms|s)?$/.test(v), "a collapsed duration");
  }
  results.push({ label: "print sets one light palette over every theme", errors: prErrors });

  return results;
}

function main(argv) {
  const { pkg, extra } = parseArgs(argv);
  let failed = 0;
  for (const r of checkPackage(pkg, extra)) {
    console.log(`${r.errors.length ? "FAIL" : "ok  "} ${r.label}`);
    for (const e of r.errors) console.log(`       ${e}`);
    failed += r.errors.length;
  }
  if (failed) {
    console.error(`theme rules: ${failed} violation(s)`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main(process.argv.slice(2));
