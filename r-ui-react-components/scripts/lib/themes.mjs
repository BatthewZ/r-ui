// Theme discovery for the gates: every top-level block under
// @batthewz/r-ui-css/src that declares `--SCHEME-DARK` is a theme. Found by
// reading files, never by a list of names: example themes have no privileges,
// including in gates. Each theme's declarations are overlaid on the `:root`
// defaults (the default theme IS `:root`), the way the cascade does it for
// `:root[data-theme="x"]` rules. The print palette (`:root` inside
// `@media print`, every declaration `!important`) replaces any theme's colours
// on paper, so it is measured as one more theme.
//
// A consumer's theme files can be measured instead (`discoverThemes({ files })`):
// their `--SCHEME-DARK` blocks are the themes, read the same way, over the CSS
// package's defaults plus any plain `:root` declarations those files make.
//
// No dependency beyond Node: a gate built on this ships to consumers.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { readBlocks } from "./css.mjs";
import { PKG } from "./gate.mjs";

/**
 * `src/` of the installed @batthewz/r-ui-css, found the way Node resolves a
 * package: in `node_modules` here or in any directory above (a workspace links
 * it into this package's own; an app's install hoists it beside this package).
 * Its `exports` map does not expose `package.json`, so `require.resolve`
 * cannot find it.
 */
export function cssPackageSrc() {
  for (let dir = PKG; ; dir = dirname(dir)) {
    const src = join(dir, "node_modules", "@batthewz", "r-ui-css", "src");
    if (existsSync(src)) return realpathSync(src);
    if (dirname(dir) === dir) return null;
  }
}

/** Every `.css` file under `dir`, sorted, minus `_`-prefixed templates. */
function cssFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".css") && !/(^|\/)_/.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/** Theme blocks (`--SCHEME-DARK`, top level or in `@media print`) and plain `:root` declarations in one file. */
function readThemeFile(file, label) {
  const root = new Map();
  const themes = [];
  for (const block of readBlocks(readFileSync(file, "utf8"))) {
    const print = block.parents.length === 1 && isPrintMedia(block.parents[0]);
    if (block.parents.length > 0 && !print) continue;
    if (block.prelude === ":root" && !print) for (const d of block.decls) root.set(d.name, d.value);
    if (block.decls.some((d) => d.name === "--SCHEME-DARK")) {
      const decls = block.decls.map((d) => ({ ...d, value: d.value.replace(/\s*!important$/, "") }));
      const prelude = print ? `${block.parents[0]} ${block.prelude}` : block.prelude;
      themes.push({ label: `${label} ${prelude}`, block: { ...block, decls } });
    }
  }
  return { root, themes };
}

/**
 * `[{ label, scheme: "light"|"dark", decls: Map<name, value>, own }]`: the CSS
 * package's themes, default first, or, given `files`, the themes those files
 * declare. Empty when the CSS package is not installed.
 */
export function discoverThemes({ files = [] } = {}) {
  const src = cssPackageSrc();
  if (!src) return [];
  const rootDecls = new Map();
  const shipped = [];
  for (const file of cssFiles(src)) {
    const { root, themes } = readThemeFile(file, relative(src, file));
    for (const [name, value] of root) rootDecls.set(name, value);
    shipped.push(...themes);
  }
  let themeBlocks = shipped;
  if (files.length > 0) {
    themeBlocks = [];
    for (const file of files) {
      const { root, themes } = readThemeFile(file, relative(process.cwd(), file) || file);
      for (const [name, value] of root) rootDecls.set(name, value);
      themeBlocks.push(...themes);
    }
  }
  return themeBlocks.map(({ label, block }) => {
    const decls = new Map(rootDecls);
    for (const d of block.decls) decls.set(d.name, d.value);
    const scheme = Number(decls.get("--SCHEME-DARK")) >= 1 ? "dark" : "light";
    return { label, scheme, decls, own: new Map(block.decls.map((d) => [d.name, d.value])) };
  });
}

/** `@media print` (alone or with other queries), never `not print`. */
function isPrintMedia(prelude) {
  return /^@media\b/.test(prelude) && /(^|[\s,(])print\b/.test(prelude) && !/\bnot\s+print\b/.test(prelude);
}

/** Resolve `var(--X)` / `var(--X, fallback)` chains against a declaration map. */
export function resolveValue(value, decls, seen = new Set()) {
  const m = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(value.trim());
  if (!m) return value.trim();
  if (seen.has(m[1])) return null;
  seen.add(m[1]);
  const next = decls.get(m[1]) ?? m[2];
  return next === undefined ? null : resolveValue(next, decls, seen);
}
