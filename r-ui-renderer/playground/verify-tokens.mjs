#!/usr/bin/env node
// Asserts that the playground's chrome speaks tokens only and gives no example
// theme a privilege. Fails on:
//   - in its stylesheets: a raw colour; a raw length (only `0` and `100dvh`, the
//     viewport itself, are allowed; `%` and `fr` are proportions, not sizes),
//     media queries included; a custom property no token declares, or a
//     density's named value (`--X-COMPACT`) read directly; a class without the
//     `pg-` prefix;
//   - in its components: a literal class in `className` that is neither `pg-`
//     nor in the renderer's class vocabulary (the token utilities, no Tailwind
//     defaults);
//   - anywhere in playground/ (fixtures included): the name of one of the CSS
//     package's example themes, outside the theme list (themes.ts, themes.css).
//
// Usage: node playground/verify-tokens.mjs

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = dirname(HERE);
const THEME_LIST = new Set(["themes.ts", "themes.css"]);

const ALLOWED_LENGTHS = new Set(["100dvh"]);
const LENGTH = /(?<![\w.-])(\d*\.?\d+)(px|rem|em|pt|ch|ex|lh|vw|vh|vi|vb|vmin|vmax|cqi|cqb|dvh|svh|lvh)(?![\w-])/g;
const COLOUR = /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;
const DENSITY_NAMED = /-(COMFORTABLE|COMPACT)$/;

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const blankComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

function rawLengths(text) {
  return [...text.matchAll(LENGTH)].filter((m) => Number(m[1]) !== 0 && !ALLOWED_LENGTHS.has(m[0])).map((m) => m[0]);
}

/** Problems in one stylesheet; `tokens` is every custom property the contract and the library declare. */
export function cssProblems(css, tokens) {
  const problems = [];
  const text = blankComments(css).replace(/@(import|source)[^;]*;/g, (rule) => rule.replace(/[^\n]/g, " "));
  for (const at of text.matchAll(/@(media|container|supports)([^{]*)\{/g)) {
    for (const length of rawLengths(at[2].replace(/--theme\([^)]*\)/g, ""))) {
      problems.push({ line: lineOf(text, at.index), problem: `@${at[1]}${at[2].trimEnd()}: the raw length ${length}; use a token` });
    }
  }
  for (const block of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1].trim();
    const line = lineOf(text, block.index + block[0].indexOf(selector));
    for (const cls of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
      if (!cls[1].startsWith("pg-")) problems.push({ line, problem: `${selector}: the class \`${cls[1]}\` lacks the pg- prefix` });
    }
    for (const decl of block[2].split(";")) {
      const colon = decl.indexOf(":");
      if (colon === -1) continue;
      const value = decl.slice(colon + 1).trim();
      const where = `${selector} { ${decl.slice(0, colon).trim()}: ${value} }`;
      const raw = value.replace(/var\(--[\w-]+\)/g, "");
      for (const length of rawLengths(raw)) problems.push({ line, problem: `${where}: the raw length ${length}; use a token` });
      if (COLOUR.test(raw)) problems.push({ line, problem: `${where}: a raw colour; use a token` });
      for (const read of value.matchAll(/var\((--[\w-]+)/g)) {
        if (DENSITY_NAMED.test(read[1])) problems.push({ line, problem: `${where}: reads ${read[1]}, a density's named value; read the selected token` });
        else if (!tokens.has(read[1])) problems.push({ line, problem: `${where}: reads ${read[1]}, which no token declares` });
      }
    }
  }
  return problems;
}

/** Problems in one component: each literal class in a `className` must be `pg-` or in `vocabulary`. */
export function classProblems(source, vocabulary) {
  const problems = [];
  const literals = /className=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\}|\{\s*`([^`]*)`\s*\})/g;
  for (const match of source.matchAll(literals)) {
    const classes = (match[1] ?? match[2] ?? match[3]).replace(/\$\{[^}]*\}/g, " ").split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      if (!cls.startsWith("pg-") && !vocabulary.has(cls)) {
        problems.push({ line: lineOf(source, match.index), problem: `the class \`${cls}\` is neither pg- nor a token utility in the vocabulary` });
      }
    }
  }
  return problems;
}

/** Problems in any file: an example theme's name, as a word, in any case. */
export function themeNameProblems(source, names) {
  const problems = [];
  for (const name of names) {
    for (const match of source.matchAll(new RegExp(`\\b${name}\\b`, "gi"))) {
      problems.push({ line: lineOf(source, match.index), problem: `names the example theme "${match[0]}"; only the theme list may` });
    }
  }
  return problems;
}

function declaredProperties(dir) {
  const names = new Set();
  for (const file of globSync("**/*.css", { cwd: dir, absolute: true, ignore: ["**/node_modules/**"] })) {
    for (const match of readFileSync(file, "utf8").matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) names.add(match[1]);
  }
  return names;
}

function main() {
  const require = createRequire(join(PKG, "package.json"));
  const cssPackage = dirname(dirname(require.resolve("@batthewz/r-ui-css")));
  const library = dirname(dirname(require.resolve("@batthewz/r-ui-react-components/styles")));
  const playgroundCss = globSync("**/*.css", { cwd: HERE, absolute: true, ignore: ["dist/**", "node_modules/**"] });
  const tokens = new Set([...declaredProperties(join(cssPackage, "src")), ...declaredProperties(join(library, "dist"))]);
  for (const file of playgroundCss) for (const match of readFileSync(file, "utf8").matchAll(/(--pg-[\w-]+)\s*:/g)) tokens.add(match[1]);
  const vocabulary = new Set(JSON.parse(readFileSync(join(PKG, "src", "spec", "class-vocabulary.json"), "utf8")));
  const themeNames = readdirSync(join(cssPackage, "src", "examples", "themes"))
    .filter((file) => file.endsWith(".css"))
    .map((file) => basename(file, ".css"));
  if (themeNames.length === 0) throw new Error("verify-tokens: the CSS package lists no example themes to guard");

  const offenders = [];
  const files = globSync("**/*", { cwd: HERE, absolute: true, nodir: true, ignore: ["dist/**", "node_modules/**"] });
  for (const file of files.sort()) {
    const rel = relative(PKG, file);
    const isText = /\.(ts|tsx|mjs|css|html|json|md|txt)$/.test(file);
    if (!isText) continue;
    const source = readFileSync(file, "utf8");
    const found = [];
    if (!THEME_LIST.has(basename(file))) found.push(...themeNameProblems(source, themeNames));
    if (file.endsWith(".css")) found.push(...cssProblems(source, tokens));
    if (/\.tsx?$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx")) found.push(...classProblems(source, vocabulary));
    for (const { line, problem } of found) offenders.push(`${rel}:${line}  ${problem}`);
  }

  if (offenders.length > 0) {
    console.error(`verify:playground — ${offenders.length} problem(s):\n${offenders.map((o) => `  ${o}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`verify:playground — OK (${files.length} files: tokens only, no example theme outside the theme list)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
