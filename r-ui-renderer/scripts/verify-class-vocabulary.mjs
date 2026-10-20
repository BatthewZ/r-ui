#!/usr/bin/env node
// Asserts that the class vocabulary is real and that the renderer's own CSS
// speaks tokens only. It compiles `src/styles.css` on top of the CSS package
// with Tailwind, as a host's build would, and fails on:
//   - a vocabulary class that generates no CSS (the CSS package removes
//     Tailwind's default scales, so `text-sm` compiles to nothing, silently);
//   - a vocabulary class the compiled stylesheet does not hold (the
//     `@source inline(...)` block and the validator's list disagree);
//   - a replaced Tailwind default (`p-4`, `text-sm`, …) in the vocabulary or
//     in the compiled stylesheet;
//   - in the stylesheet's own rules: a raw length or colour, a custom property
//     read that neither the CSS package nor the component library declares, or
//     a class without the `r-renderer-` prefix.
//
// Usage: node scripts/verify-class-vocabulary.mjs [--root <dir>]
//   --root checks another tree with the same layout (the test's fixtures).

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { __unstable__loadDesignSystem, compile } from "@tailwindcss/node";

import { REPLACED_DEFAULTS } from "./lib/class-vocabulary.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);
const require = createRequire(join(PKG, "package.json"));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cssEscape = (s) => s.replace(/[^\w-]/g, (c) => `\\${c}`);
const hasClassRule = (compiled, cls) => new RegExp(`\\.${escapeRe(cssEscape(cls))}(?![\\w-])`).test(compiled);

/** Every custom property a package's CSS declares. */
function declaredProperties(dir) {
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

/** The stylesheet with comments and the generated `@source` lines removed: its own rules. */
const ownRules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@source[^;]*;/g, "");

const problems = [];
const stylesheet = readFileSync(join(ROOT, "src", "styles.css"), "utf8");
const vocabulary = JSON.parse(readFileSync(join(ROOT, "src", "spec", "class-vocabulary.json"), "utf8"));
if (!Array.isArray(vocabulary) || vocabulary.length === 0) problems.push("src/spec/class-vocabulary.json: no classes");

for (const cls of REPLACED_DEFAULTS) {
  if (vocabulary.includes(cls)) problems.push(`\`${cls}\` is a Tailwind default the CSS package replaces, and is in the vocabulary`);
}

const entry = `@import "@batthewz/r-ui-css";\n@import "./src/styles.css";\n`;
const design = await __unstable__loadDesignSystem(entry, { base: ROOT });
const compiled = (await compile(entry, { base: ROOT, onDependency() {} })).build([]);
const generated = design.candidatesToCss(vocabulary);
vocabulary.forEach((cls, i) => {
  if (!generated[i]) problems.push(`\`${cls}\` generates no CSS`);
  else if (!hasClassRule(compiled, cls)) problems.push(`\`${cls}\` is in the vocabulary but not in the compiled stylesheet (run \`bun run derive:classes\`)`);
});
for (const cls of REPLACED_DEFAULTS) {
  if (hasClassRule(compiled, cls)) problems.push(`\`${cls}\` is in the compiled stylesheet, a Tailwind default the CSS package replaces`);
}

const cssPackage = dirname(dirname(require.resolve("@batthewz/r-ui-css")));
const library = dirname(dirname(require.resolve("@batthewz/r-ui-react-components/styles")));
const tokens = new Set([...declaredProperties(join(cssPackage, "src")), ...declaredProperties(join(library, "dist"))]);
const own = ownRules(stylesheet);
for (const block of own.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = block[1].trim();
  for (const cls of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
    if (!cls[1].startsWith("r-renderer-")) problems.push(`${selector}: the class \`${cls[1]}\` lacks the r-renderer- prefix`);
  }
  for (const decl of block[2].split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    const raw = value.replace(/var\(--[\w-]+\)/g, "");
    const lengths = [...raw.matchAll(/(?<![\w.-])(\d*\.?\d+)(px|rem|em|%|vh|vw|vi|vb|ch|ex|pt|cqi|cqb|dvh|svh|lvh)(?![\w-])/g)];
    if (lengths.some((length) => Number(length[1]) !== 0)) {
      problems.push(`${selector} { ${prop}: ${value} }: a raw length; use a token`);
    }
    if (/#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(raw)) {
      problems.push(`${selector} { ${prop}: ${value} }: a raw colour; use a token`);
    }
    for (const read of value.matchAll(/var\((--[\w-]+)/g)) {
      if (!tokens.has(read[1])) problems.push(`${selector} { ${prop}: ${value} }: reads ${read[1]}, which no token declares`);
    }
  }
}

if (problems.length > 0) {
  console.error(`verify:class-vocabulary — ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`verify:class-vocabulary — OK (${vocabulary.length} classes compile; the stylesheet reads tokens only)`);
