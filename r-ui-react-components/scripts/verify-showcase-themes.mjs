#!/usr/bin/env node
// Holds the showcase's own themes (`showcase/themes/*.css`) to the gates a
// shipped theme meets. They are consumer files, so the package-wide gates never
// discover them, and verify:no-raw-tailwind skips them (a theme declares the raw
// values tokens stand for). On every file there this runs:
//   - the CSS package's shipped contrast and theme-rules checks;
//   - this package's domain-contrast and series-palette gates (`--theme`).
// No theme file at all fails: an empty directory would pass vacuously.
//
// Usage: node scripts/verify-showcase-themes.mjs [--dir <dir>]
//   --dir  another directory of theme files (the test's fixtures).

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { PKG, pathArg } from "./lib/gate.mjs";
import { cssPackageSrc } from "./lib/themes.mjs";

const DIR = pathArg("--dir", join(PKG, "showcase", "themes"));
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".css") && !f.startsWith("_"))
  .sort()
  .map((f) => join(DIR, f));
const where = relative(process.cwd(), DIR) || ".";

if (files.length === 0) {
  console.error(`verify:showcase-themes — no theme file in ${where}; the gate measured nothing.`);
  process.exit(1);
}

const cssSrc = cssPackageSrc();
if (!cssSrc) {
  console.error("verify:showcase-themes — @batthewz/r-ui-css is not installed; its theme checks cannot run.");
  process.exit(1);
}
const cssScripts = join(cssSrc, "..", "scripts");
const themeArgs = files.flatMap((f) => ["--theme", f]);

const gates = [
  ["contrast", join(cssScripts, "check-contrast.mjs"), files],
  ["theme rules", join(cssScripts, "check-theme-rules.mjs"), files],
  ["domain contrast", join(PKG, "scripts", "verify-domain-contrast.mjs"), themeArgs],
  ["series palette", join(PKG, "scripts", "verify-series-palette.mjs"), themeArgs],
];

const failed = [];
for (const [name, script, args] of gates) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: PKG, encoding: "utf8" });
  if (result.status !== 0) failed.push(`[${name}]\n${`${result.stdout}${result.stderr}`.trim()}`);
}

if (failed.length > 0) {
  console.error(`verify:showcase-themes — ${failed.length} gate(s) failed on ${where}:\n\n${failed.join("\n\n")}`);
  process.exit(1);
}
console.log(`verify:showcase-themes — OK (${files.length} theme file(s) in ${where}: ${gates.map(([n]) => n).join(", ")})`);
