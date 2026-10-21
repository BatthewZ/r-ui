#!/usr/bin/env node
// Asserts that every text file in the package stays text: no raw control
// character other than tab, LF, VT, FF and CR. One raw NUL in a string literal
// (easy to paste while testing URL smuggling) makes git treat the whole file
// as binary: its diff becomes "Binary files differ" and git grep and ripgrep
// skip it, so it drops out of review and search. Write such characters as
// escapes ("\u0000"); the string is the same.
//
// Usage: node scripts/verify-source-text.mjs [--root <dir>]

import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { globSync } from "glob";

import { failWith, PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);

const files = globSync(["**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,css,html}"], {
  cwd: ROOT,
  absolute: true,
  nodir: true,
  ignore: ["**/node_modules/**", "**/dist/**"],
}).sort();

function isControl(code) {
  return code < 0x09 || (code > 0x0d && code < 0x20) || code === 0x7f;
}

const problems = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const char of line) {
        const code = char.codePointAt(0) ?? 0;
        if (isControl(code)) {
          problems.push(`${relative(ROOT, file)}:${index + 1}  U+${code.toString(16).toUpperCase().padStart(4, "0")}`);
          break;
        }
      }
    });
}

if (files.length === 0) {
  console.error("verify:source-text — no files found; the scan is broken");
  process.exit(1);
}
if (problems.length > 0) {
  failWith(`verify:source-text — ${problems.length} line(s) with a raw control character`, problems, 'Write it as an escape ("\\u0000") instead.');
}
console.log(`verify:source-text — OK (${files.length} file(s))`);
