#!/usr/bin/env node
// Asserts that every class and keyframes name this package's CSS defines carries
// its owner's prefix: `r-<group>-…` in `src/components/<group>/styles.css`,
// `r-<file>-…` in a shared stylesheet directly under `src/` (`r-floating-…`).
//
// Class names are global. Groups written in parallel invent the same short
// names (`.r-hit` twice was a silent rule merge), and a consumer's own `.card`
// or `.form-input` would merge with ours. The prefix makes every name ours and
// says which file owns it. Classes the contract package defines (`prose`,
// `not-prose`, utilities) are read, never defined, here, so they never appear
// as a selector's subject in these files; a reference to one inside `:is()`,
// `:has()` or `:not()` is fine and is not checked.
//
// Usage: node scripts/verify-class-prefix.mjs [--root <dir>]

import { readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > -1 ? resolve(process.argv[rootArg + 1]) : PKG;

/** The prefix a stylesheet's own names must carry. */
function prefixFor(file) {
  const rel = relative(join(ROOT, "src"), file).split("\\").join("/");
  const group = rel.match(/^components\/([^/]+)\/styles\.css$/);
  if (group) return `r-${group[1]}-`;
  if (!rel.includes("/")) return `r-${basename(rel, ".css")}-`;
  return null;
}

/** Strip comments, then blank every functional pseudo-class argument, which only REFERENCES names. */
function definedNames(css) {
  let text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const pseudo = /:(?:is|where|has|not)\(/g;
  let match;
  while ((match = pseudo.exec(text))) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
    }
    const start = match.index + match[0].length;
    text = text.slice(0, start) + text.slice(start, i - 1).replace(/[^\n]/g, " ") + text.slice(i - 1);
  }
  const names = [];
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  // A prelude is the text between a block boundary and the next `{`; nested
  // rules (inside `@media`) start after a `{`, top-level ones after a `}`.
  for (const sel of text.matchAll(/(?<=^|[{};])(\s*)([^{};]*)\{/g)) {
    const prelude = sel[2];
    const start = sel.index + sel[1].length;
    const at = prelude.match(/^@keyframes\s+([\w-]+)/);
    if (at) {
      names.push({ kind: "keyframes", name: at[1], line: lineOf(start) });
      continue;
    }
    if (prelude.startsWith("@") || /^(?:from|to|\d+%)/.test(prelude)) continue;
    for (const cls of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      names.push({ kind: "class", name: cls[1], line: lineOf(start + cls.index) });
    }
  }
  return names;
}

const files = globSync("src/**/*.css", { cwd: ROOT, absolute: true, nodir: true, ignore: ["**/node_modules/**"] }).sort();
const offenders = [];
let checked = 0;
for (const file of files) {
  const prefix = prefixFor(file);
  if (!prefix) continue;
  for (const { kind, name, line } of definedNames(readFileSync(file, "utf8"))) {
    checked++;
    if (!name.startsWith(prefix)) {
      offenders.push(`${relative(ROOT, file)}:${line}  ${kind} \`${name}\` must start with \`${prefix}\``);
    }
  }
}

if (checked === 0) {
  console.error("verify:class-prefix — no class or keyframes names found; the scan is broken");
  process.exit(1);
}
if (offenders.length > 0) {
  console.error(
    `verify:class-prefix — ${offenders.length} unprefixed name(s):\n` +
      offenders.map((o) => `  ${o}`).join("\n") +
      "\n\nClass names are global. Prefix a group's names `r-<group>-` and a shared\n" +
      "stylesheet's `r-<file>-`, so no two groups, and no consumer, can collide.",
  );
  process.exit(1);
}
console.log(`verify:class-prefix — OK (${checked} name(s) in ${files.length} stylesheet(s))`);
