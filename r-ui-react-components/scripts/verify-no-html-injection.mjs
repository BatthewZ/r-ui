#!/usr/bin/env node
// Asserts that no shipped source and no showcase file turns a string into
// markup: no `dangerouslySetInnerHTML`, no assignment to `innerHTML` /
// `outerHTML`, no `insertAdjacentHTML`, `document.write` or
// `createContextualFragment`.
//
// Components here render content they did not write (Markdown from a CMS or a
// model, code from an API). They do it by building React elements from a tree,
// so untrusted text lands in text nodes and there is no sanitizer to get wrong.
// One string-to-markup call anywhere reopens that hole for every caller, and it
// always looks locally harmless ("it is only our own highlighter's output").
// There is no allowance: if something seems to need one, render a tree instead.
//
// A grep, on purpose: these names have no legitimate spelling in this package.
// Comment lines (`//`, ` * `) are skipped so prose can say what is banned. Test
// files are skipped (they never ship, and DOM resets in them are not rendering).
//
// Usage: node scripts/verify-no-html-injection.mjs [--root <dir>]

import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > -1 ? resolve(process.argv[rootArg + 1]) : PKG;

const BANNED = [
  [/\bdangerouslySetInnerHTML\b/, "dangerouslySetInnerHTML"],
  [/\.(?:inner|outer)HTML\s*(?:=(?!=)|\+=)/, "an innerHTML/outerHTML assignment"],
  [/\binsertAdjacentHTML\b/, "insertAdjacentHTML"],
  [/\bdocument\s*\.\s*write(?:ln)?\s*\(/, "document.write"],
  [/\bcreateContextualFragment\b/, "createContextualFragment"],
];

const files = globSync("{src,showcase}/**/*.{ts,tsx,js,jsx,mjs}", {
  cwd: ROOT,
  absolute: true,
  nodir: true,
  ignore: ["**/node_modules/**", "**/dist/**", "**/*.test.*"],
}).sort();

const problems = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (/^\s*(?:\/\/|\/?\*)/.test(line)) return;
      for (const [pattern, name] of BANNED) {
        if (pattern.test(line)) problems.push(`${relative(ROOT, file)}:${index + 1}  ${name}`);
      }
    });
}

if (files.length === 0) {
  console.error("verify:no-html-injection — no source files found; the scan is broken");
  process.exit(1);
}
if (problems.length > 0) {
  console.error(
    `verify:no-html-injection — ${problems.length} string-to-markup call(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n\n` +
      "Render a tree of React elements instead (text in text nodes). There is no allowance.",
  );
  process.exit(1);
}
console.log(`verify:no-html-injection — OK (${files.length} file(s), no string becomes markup)`);
