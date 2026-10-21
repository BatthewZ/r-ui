// Reading the installed CSS packages and stylesheets, shared by the class
// vocabulary's writer and gate and the playground's token gate.

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { PKG } from "./gate.mjs";

const require = createRequire(join(PKG, "package.json"));

/** The CSS package's directory, as installed beside this one (its entry is `src/index.css`). */
export function cssPackageDir() {
  return dirname(dirname(require.resolve("@batthewz/r-ui-css")));
}

/** The component library's directory, as installed beside this one (its stylesheet is `dist/styles.css`). */
export function libraryDir() {
  return dirname(dirname(require.resolve("@batthewz/r-ui-react-components/styles")));
}

/** Every custom property the CSS under `dir` declares, `node_modules` skipped. */
export function declaredProperties(dir) {
  const names = new Set();
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(join(at, entry.name));
      } else if (entry.name.endsWith(".css")) {
        for (const match of readFileSync(join(at, entry.name), "utf8").matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) names.add(match[1]);
      }
    }
  };
  walk(dir);
  return names;
}

/** Every custom property the contract (the CSS package's source) and the library's built CSS declare. */
export function declaredTokens() {
  return new Set([...declaredProperties(join(cssPackageDir(), "src")), ...declaredProperties(join(libraryDir(), "dist"))]);
}

/** A colour written as a value rather than read from a token. */
export const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;

/** Each innermost rule of `css`: its selector, where the selector starts, and its `prop: value` declarations. */
export function* ruleBlocks(css) {
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1].trim();
    const declarations = [];
    for (const decl of block[2].split(";")) {
      const colon = decl.indexOf(":");
      if (colon !== -1) declarations.push({ prop: decl.slice(0, colon).trim(), value: decl.slice(colon + 1).trim() });
    }
    yield { selector, index: block.index + block[0].indexOf(selector), declarations };
  }
}
