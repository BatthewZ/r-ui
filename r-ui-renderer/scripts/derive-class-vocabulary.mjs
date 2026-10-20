#!/usr/bin/env node
// Writes the class vocabulary (scripts/lib/class-vocabulary.mjs) where it is
// used: as data for the validator (`src/spec/class-vocabulary.json`) and as
// `@source inline(...)` lines in the renderer's stylesheet, so a host's
// Tailwind build generates every class a document may write. `--check`
// regenerates both in memory and fails on a difference.
//
// Usage: node scripts/derive-class-vocabulary.mjs [--check] [--root <dir>]
//   --root writes into another tree with the same layout (this script's test).

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

import { classVocabulary } from "./lib/class-vocabulary.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);
const BEGIN = "/* GENERATED:class-vocabulary (scripts/derive-class-vocabulary.mjs); do not edit by hand */";
const END = "/* /GENERATED:class-vocabulary */";

/** The CSS package's directory, as installed beside this one (its entry is `src/index.css`). */
function cssPackageDir() {
  const require = createRequire(join(PKG, "package.json"));
  return dirname(dirname(require.resolve("@batthewz/r-ui-css")));
}

/** `@source inline(...)` lines, each under 100 characters, in vocabulary order. */
function sourceLines(classes) {
  const lines = [];
  let line = [];
  for (const cls of classes) {
    if (line.length > 0 && `@source inline("${[...line, cls].join(" ")}");`.length > 100) {
      lines.push(line);
      line = [];
    }
    line.push(cls);
  }
  if (line.length > 0) lines.push(line);
  return lines.map((group) => `@source inline("${group.join(" ")}");`);
}

/** `css` with its generated block replaced; throws when the markers are missing. */
function spliceStylesheet(css, classes) {
  const begin = css.indexOf(BEGIN);
  const end = css.indexOf(END);
  if (begin === -1 || end === -1 || end < begin) throw new Error(`src/styles.css: the ${BEGIN} … ${END} markers are missing`);
  return `${css.slice(0, begin)}${[BEGIN, ...sourceLines(classes), END].join("\n")}${css.slice(end + END.length)}`;
}

function main() {
  const check = process.argv.includes("--check");
  const classes = classVocabulary(cssPackageDir());
  const targets = [
    [join(ROOT, "src", "spec", "class-vocabulary.json"), () => `${JSON.stringify(classes, null, 2)}\n`],
    [join(ROOT, "src", "styles.css"), (current) => spliceStylesheet(current, classes)],
  ];

  const stale = [];
  for (const [path, render] of targets) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      current = "";
    }
    const next = render(current);
    if (next === current) continue;
    if (check) stale.push(relative(ROOT, path));
    else writeFileSync(path, next);
  }

  if (stale.length > 0) {
    console.error(`derive-class-vocabulary --check — stale: ${stale.join(", ")}\nRun \`bun run derive:classes\`.`);
    process.exit(1);
  }
  console.log(`derive-class-vocabulary — ${check ? "OK" : "written"} (${classes.length} classes)`);
}

try {
  main();
} catch (error) {
  console.error(`derive-class-vocabulary — ${error.message}`);
  process.exit(1);
}
