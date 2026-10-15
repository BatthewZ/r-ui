// Theme discovery for the gates: every top-level block under
// @batthewz/r-ui-css/src that declares `--SCHEME-DARK` is a theme. Found by
// reading files, never by a list of names: example themes have no privileges,
// including in gates. Each theme's declarations are overlaid on the `:root`
// defaults (the default theme IS `:root`), the way the cascade does it for
// `:root[data-theme="x"]` rules.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

import { readBlocks } from "./css.mjs";

/**
 * `src/` of the installed @batthewz/r-ui-css. Its `exports` map does not
 * expose `package.json`, so `require.resolve` cannot find it; the dependency
 * is linked into this package's own node_modules (workspace / isolated linker).
 */
const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function cssPackageSrc() {
  const src = join(PKG, "node_modules", "@batthewz", "r-ui-css", "src");
  return existsSync(src) ? realpathSync(src) : null;
}

/** `[{ label, scheme: "light"|"dark", decls: Map<name, value> }]`, default first. */
export function discoverThemes() {
  const src = cssPackageSrc();
  if (!src) return [];
  const rootDecls = new Map();
  const themeBlocks = [];
  for (const file of globSync("**/*.css", { cwd: src, absolute: true }).sort()) {
    if (/(^|\/)_/.test(relative(src, file))) continue; // templates are not themes
    for (const block of readBlocks(readFileSync(file, "utf8"))) {
      if (block.parents.length > 0) continue;
      if (block.prelude === ":root") for (const d of block.decls) rootDecls.set(d.name, d.value);
      if (block.decls.some((d) => d.name === "--SCHEME-DARK")) {
        themeBlocks.push({ label: `${relative(src, file)} ${block.prelude}`, block });
      }
    }
  }
  return themeBlocks.map(({ label, block }) => {
    const decls = new Map(block.prelude === ":root" ? rootDecls : [...rootDecls]);
    for (const d of block.decls) decls.set(d.name, d.value);
    const scheme = Number(decls.get("--SCHEME-DARK")) >= 1 ? "dark" : "light";
    return { label, scheme, decls, own: new Map(block.decls.map((d) => [d.name, d.value])) };
  });
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
