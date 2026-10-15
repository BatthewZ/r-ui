#!/usr/bin/env node
// Asserts every domain colour has LIGHT and DARK values and is only ever read
// through the --SCHEME-DARK blend. Rules: scripts/lib/domain-pairs.mjs.

import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

import { checkHalfReads, checkTokens } from "./lib/domain-pairs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { problems, pairs } = checkTokens(readFileSync(join(ROOT, "src", "tokens.css"), "utf8"));

const sources = globSync("{src/components,showcase}/**/*.{ts,tsx,css}", {
  cwd: ROOT,
  absolute: true,
  nodir: true,
  ignore: ["**/*.test.*", "**/dist/**"],
});
for (const file of sources) problems.push(...checkHalfReads(readFileSync(file, "utf8"), relative(ROOT, file)));

if (pairs.length === 0) problems.push("src/tokens.css  found ZERO LIGHT/DARK pairs; the gate measured nothing.");

if (problems.length > 0) {
  console.error(`verify:domain-pairs — ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`verify:domain-pairs — OK (${pairs.length} pairs, all exposed by a blend; ${sources.length} source file(s) read no half alone)`);
