#!/usr/bin/env node
// Writes what a document's `theme` may set and must meet, from the installed
// CSS package, never from a hand-kept list:
//   - `src/spec/theme-contract.json`: the colour roles of the theme template
//     (`--C-*`, in its order, with its one-line role, whether the template
//     writes it translucent, and the vocabulary utilities that paint it), and
//     every pair the package's own contrast check measures, with its floor;
//   - the stylesheet's theme region: a document's roles yield to print and
//     forced colours (inherited from the page, as a theme's yield on :root),
//     and re-derive the package's more-contrast substitutions from the
//     document's own roles.
// A translucent role in a contrast pair throws: the format allows alpha only
// on roles no pair measures. `--check` regenerates in memory and fails on a
// difference, naming the stale file.
//
// Usage: node scripts/derive-theme.mjs [--check] [--root <dir>] [--css <dir>]
//   --root writes into another tree with the same layout, --css reads another
//   copy of the CSS package (this script's test).

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { colorUtilities } from "./lib/class-vocabulary.mjs";
import { cssPackageDir } from "./lib/css.mjs";
import { isMain, PKG, pathArg, readText } from "./lib/gate.mjs";

const CONTRACT = join("src", "spec", "theme-contract.json");
const STYLES = join("src", "styles.css");
const BEGIN = "/* GENERATED:theme (scripts/derive-theme.mjs); do not edit by hand */";
const END = "/* /GENERATED:theme */";

const ROLE_DECL = /^\s*(--C-[A-Z0-9-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*(.*?)\s*\*\/)?/gm;

/** Whether a template value is translucent: an alpha after `/` in a function, or a 4- or 8-digit hex. */
const isTranslucent = (value) => /\(\s*[^)]*\/[^)]*\)/.test(value) || /#(?:[0-9a-f]{4}|[0-9a-f]{8})\b/i.test(value);

/** The template's colour roles, in its order. */
function templateRoles(cssDir) {
  const template = readFileSync(join(cssDir, "src", "_theme-template.css"), "utf8");
  const roles = [...template.matchAll(ROLE_DECL)].map(([, name, value, role]) => ({ name, value: value.trim(), role: role ?? "" }));
  if (roles.length === 0) throw new Error("the theme template declares no --C-* role");
  return roles;
}

/** `--C-*` → its `@theme` colour key (`--color-<key>: var(--C-…)`), across the package's sources. */
function colourKeys(sheets) {
  const keys = new Map();
  for (const css of sheets) {
    for (const [, key, token] of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*var\((--C-[A-Z0-9-]+)\)/g)) keys.set(token, key);
  }
  return keys;
}

/** Every declaration the package makes on `:root` under `@media (prefers-contrast: more)`, colour roles only. */
function moreContrast(cssLib, entry) {
  const decls = [];
  const visit = (nodes, inMore) => {
    for (const node of nodes) {
      const here = inMore || (node.type === "at" && node.name === "media" && /prefers-contrast\s*:\s*more/.test(node.prelude));
      if (here && node.type === "rule" && cssLib.splitSelectors(node.selector).includes(":root")) {
        for (const decl of node.decls) if (decl.prop.startsWith("--C-")) decls.push({ prop: decl.prop, value: decl.value });
      }
      if (node.children) visit(node.children, here);
    }
  };
  visit(cssLib.loadSheet(entry), false);
  return decls;
}

/** The contract and the stylesheet region, from the CSS package at `cssDir`. */
export async function deriveTheme(cssDir) {
  const load = (file) => import(pathToFileURL(join(cssDir, "scripts", ...file.split("/"))).href);
  const [{ measureTheme }, tokensLib, cssLib] = await Promise.all([load("check-contrast.mjs"), load("lib/tokens.mjs"), load("lib/css.mjs")]);

  const sheets = cssLib
    .listFiles(join(cssDir, "src"))
    .filter((file) => file.endsWith(".css") && !file.includes(join("src", "examples")))
    .map((file) => readFileSync(file, "utf8"));
  const keys = colourKeys(sheets);
  const tokens = templateRoles(cssDir).map(({ name, value, role }) => {
    const key = keys.get(name);
    return { name, role, utilities: key === undefined ? [] : colorUtilities(key), translucent: isTranslucent(value) };
  });

  const measured = measureTheme({ name: "default", tokens: tokensLib.loadDefaults(cssDir) });
  const pairs = measured.filter((r) => r.kind !== "scheme").map(({ fg, bg, min, kind }) => ({ fg, bg, min, kind }));
  const schemeChecks = measured.filter((r) => r.kind === "scheme");
  if (schemeChecks.length !== 1) throw new Error(`the contrast check measures ${schemeChecks.length} scheme coherence rows; expected 1`);
  const scheme = { text: schemeChecks[0].fg, canvas: schemeChecks[0].bg };

  const byName = new Map(tokens.map((token) => [token.name, token]));
  for (const name of [...pairs.flatMap((p) => [p.fg, p.bg]), scheme.text, scheme.canvas]) {
    const token = byName.get(name);
    if (token === undefined) throw new Error(`${name} is measured by the contrast check but is not a role in the theme template`);
    if (token.translucent) throw new Error(`${name} is in a contrast pair but the template writes it translucent; the format allows alpha only on roles no pair measures`);
  }

  const contrast = moreContrast(cssLib, join(cssDir, "src", "index.css"));
  for (const { prop } of contrast) if (!byName.has(prop)) throw new Error(`more contrast sets ${prop}, which is not a role in the theme template`);

  return { contract: { tokens, pairs, scheme }, region: stylesheetRegion(tokens, contrast) };
}

function stylesheetRegion(tokens, contrast) {
  const block = (media, comment, decls) => [`  /* ${comment} */`, `  @media ${media} {`, "    .r-renderer-themed {", ...decls.map((d) => `      ${d}`), "    }", "  }"];
  return [
    BEGIN,
    ...block("(prefers-contrast: more)", "A document's roles take the package's more-contrast substitutions, from its own values.", contrast.map(({ prop, value }) => `${prop}: ${value} !important;`)),
    ...block(
      "print, (forced-colors: active)",
      "Print and forced colours replace every theme's roles on :root; a document's yield to them too.",
      ["color-scheme: inherit !important;", "--SCHEME-DARK: inherit !important;", ...tokens.map(({ name }) => `${name}: inherit !important;`)],
    ),
    END,
  ].join("\n");
}

/** `css` with its theme region replaced; throws when the markers are missing. */
function spliceStylesheet(css, region) {
  const begin = css.indexOf(BEGIN);
  const end = css.indexOf(END);
  if (begin === -1 || end === -1 || end < begin) throw new Error(`${STYLES}: the ${BEGIN} … ${END} markers are missing`);
  return `${css.slice(0, begin)}${region}${css.slice(end + END.length)}`;
}

async function main() {
  const root = pathArg("--root", PKG);
  const check = process.argv.includes("--check");
  const { contract, region } = await deriveTheme(pathArg("--css", cssPackageDir()));
  const targets = [
    [join(root, CONTRACT), () => `${JSON.stringify(contract, null, 2)}\n`],
    [join(root, STYLES), (current) => spliceStylesheet(current, region)],
  ];
  const stale = [];
  for (const [path, render] of targets) {
    const current = readText(path) ?? "";
    const next = render(current);
    if (next === current) continue;
    if (check) stale.push(relative(root, path));
    else writeFileSync(path, next);
  }
  if (stale.length > 0) {
    console.error(`derive-theme --check — stale: ${stale.join(", ")}\nRun \`bun run derive:theme\`.`);
    process.exit(1);
  }
  console.log(`derive-theme — ${check ? "OK" : "written"} (${contract.tokens.length} roles, ${contract.pairs.length} pairs)`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`derive-theme — ${error.message}`);
    process.exit(1);
  });
}
