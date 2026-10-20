#!/usr/bin/env node
// Asserts that no source, test, gate or config file carries a lint or type
// suppression. "Never suppress, only fix": eslint's `noInlineConfig` already
// makes an eslint directive inert, so this mostly guards the TypeScript ones,
// which nothing else catches. Tests are scanned too: a suppressed error in a
// test hides a type drift the test exists to see. The directives are spelled
// in pieces here so this file is not its own finding; the fixtures the gate's
// test reads are skipped.
//
// Usage: node scripts/verify-no-suppressions.mjs [--root <dir>]

import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { globSync } from "glob";

import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);

const DIRECTIVES = [["eslint", "disable"].join("-"), ["@ts", "ignore"].join("-"), ["@ts", "expect", "error"].join("-"), ["@ts", "nocheck"].join("-")];

const files = globSync(["{src,scripts,playground}/**/*.{ts,tsx,js,jsx,mjs,cjs}", "*.{ts,js,mjs}"], {
  cwd: ROOT,
  absolute: true,
  nodir: true,
  ignore: ["**/node_modules/**", "**/dist/**", "scripts/fixtures/**"],
}).sort();

const problems = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const directive of DIRECTIVES) {
        if (line.includes(directive)) problems.push(`${relative(ROOT, file)}:${index + 1}  ${directive}`);
      }
    });
}

if (files.length === 0) {
  console.error("verify:no-suppressions — no source files found; the scan is broken");
  process.exit(1);
}
if (problems.length > 0) {
  console.error(
    `verify:no-suppressions — ${problems.length} suppression(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n\n` +
      "Fix the error instead of silencing it.",
  );
  process.exit(1);
}
console.log(`verify:no-suppressions — OK (${files.length} file(s))`);
