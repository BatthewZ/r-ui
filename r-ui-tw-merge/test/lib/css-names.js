// Reads r-ui-css from the workspace and extracts the utility names it declares:
// every `@theme` variable and every `@utility`, following relative `@import`s from
// the package's "." export.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CSS_PACKAGE_DIR = fileURLToPath(new URL("../../../r-ui-css/", import.meta.url));

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The text between the `{` at `open` and its matching `}`. */
function blockBody(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`Unbalanced braces after offset ${open}`);
}

/** Drop nested blocks (`@keyframes x { … }` may sit inside `@theme`), keeping depth-0 text. */
function topLevelText(body) {
  let depth = 0;
  let out = "";
  for (const ch of body) {
    if (ch === "{") depth++;
    if (depth === 0) out += ch;
    if (ch === "}") depth--;
  }
  return out;
}

function themeDeclarations(css) {
  const decls = [];
  for (const match of css.matchAll(/@theme\b[^{;]*\{/g)) {
    const body = topLevelText(blockBody(css, match.index + match[0].length - 1));
    for (const statement of body.split(";")) {
      const decl = statement.trim().match(/^(--[\w*-]+)\s*:\s*([\s\S]*)$/);
      if (decl) decls.push({ prop: decl[1], value: decl[2].trim() });
    }
  }
  return decls;
}

/**
 * Walk the import graph from `entry`. Returns the files visited, every `@theme`
 * declaration and `@utility` name found, and the bare (package) imports that were
 * not followed.
 */
export function readCssGraph(entry) {
  const files = [];
  const declarations = [];
  const utilities = [];
  const bareImports = [];
  const seen = new Set();

  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    files.push(file);
    const css = stripComments(readFileSync(file, "utf8"));
    for (const [, spec] of css.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)) {
      if (spec.startsWith(".") || spec.startsWith("/")) visit(resolve(dirname(file), spec));
      else bareImports.push(spec);
    }
    for (const decl of themeDeclarations(css)) declarations.push({ ...decl, file });
    for (const [, name] of css.matchAll(/@utility\s+([\w*-]+)\s*\{/g)) utilities.push(name);
  };

  visit(entry);
  return { files, declarations, utilities, bareImports };
}

/** r-ui-css's public entry, read from its package.json rather than assumed. */
export function cssPackageEntry(pkgDir = CSS_PACKAGE_DIR) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const root = pkg.exports?.["."];
  const target = typeof root === "string" ? root : (root?.style ?? root?.default);
  if (!target) throw new Error(`${pkg.name} has no "." export to read`);
  return join(pkgDir, target);
}
