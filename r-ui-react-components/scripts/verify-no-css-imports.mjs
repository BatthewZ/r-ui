#!/usr/bin/env node
// Asserts that no `.ts`/`.tsx` under `src/` imports a `.css` file.
//
// `src/styles.css` is the single registry of this package's CSS, and it puts
// every group stylesheet in `@layer components`. A second import of the same
// stylesheet from the JS graph is injected UNLAYERED by the bundler, where it
// out-ranks `@layer components`: the component then beats a caller's utility
// and `className` stops overriding it, for that component only. The old
// library shipped exactly this once. No allowlist: either the import is there
// or it is not. New CSS goes in the group's `styles.css`.
//
// The showcase is out of scope: it is a consumer app, and its entry imports
// its own stylesheet from JS the way any Vite app does.

import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const CSS_IMPORT = new RegExp(
  [
    String.raw`(?:^|\n)\s*import\b[^\n;]*["'][^"'\n]+\.css(?:\?[^"'\n]*)?["']`,
    String.raw`import\(\s*["'][^"'\n]+\.css(?:\?[^"'\n]*)?["']\s*\)`,
  ].join("|"),
  "g",
);

const files = globSync("**/*.{ts,tsx}", { cwd: SRC, absolute: true, nodir: true });
const offenders = [];

for (const file of files.sort()) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(CSS_IMPORT)) {
    const line = src.slice(0, match.index).split("\n").length;
    offenders.push(`${relative(ROOT, file)}:${line}  ${match[0].trim()}`);
  }
}

if (offenders.length > 0) {
  console.error(
    `verify:no-css-imports — ${offenders.length} CSS import(s) from JS:\n` +
      offenders.map((o) => `  ${o}`).join("\n") +
      "\n\nA stylesheet reached through the JS graph is injected UNLAYERED and beats\n" +
      "`@layer components`. Put the rules in the group's `styles.css` instead.",
  );
  process.exit(1);
}

console.log(`verify:no-css-imports — OK (${files.length} .ts/.tsx files, 0 CSS imports)`);
