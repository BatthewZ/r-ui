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
//
// Usage: node scripts/verify-no-css-imports.mjs [--root <dir>]
//   --root scans another tree with the same layout (the test's fixtures).

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { globSync } from "glob";

import { lineAt } from "./lib/css.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);

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

if (files.length === 0) {
  console.error(`verify:no-css-imports — no .ts/.tsx files under ${relative(process.cwd(), SRC) || "."}; the scan is broken`);
  process.exit(1);
}

for (const file of files.sort()) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(CSS_IMPORT)) {
    // The static form's match starts at the newline before `import`.
    const at = match.index + match[0].indexOf("import");
    offenders.push(`${relative(ROOT, file)}:${lineAt(src, at)}  ${match[0].trim()}`);
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
