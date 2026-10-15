#!/usr/bin/env node
// Asserts every domain colour has LIGHT and DARK values and is only ever read
// through the --SCHEME-DARK blend. Rules: scripts/lib/domain-pairs.mjs.
//
// Sources: every `.ts`/`.tsx`/`.css` under `src/` (the shared stylesheets and
// `util` included) and `showcase/`, minus tests and `src/tokens.css`, which is
// checked as the token file.
//
// Usage: node scripts/verify-domain-pairs.mjs [--root <dir>]
//   --root reads the sources of another tree (the test's fixture); the tokens
//   are always this package's.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { globSync } from "glob";

import { checkHalfReads, checkTokens } from "./lib/domain-pairs.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);

const { problems, pairs } = checkTokens(readFileSync(join(PKG, "src", "tokens.css"), "utf8"));

const sources = globSync("{src,showcase}/**/*.{ts,tsx,css}", {
  cwd: ROOT,
  absolute: true,
  nodir: true,
  ignore: ["**/*.test.*", "**/dist/**", "**/node_modules/**", "src/tokens.css"],
});
for (const file of sources) problems.push(...checkHalfReads(readFileSync(file, "utf8"), relative(ROOT, file)));

if (pairs.length === 0) problems.push("src/tokens.css  found ZERO LIGHT/DARK pairs; the gate measured nothing.");

if (problems.length > 0) {
  console.error(`verify:domain-pairs — ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`verify:domain-pairs — OK (${pairs.length} pairs, all exposed by a blend; ${sources.length} source file(s) read no half alone)`);
