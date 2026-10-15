#!/usr/bin/env node
// Asserts that no component (and no showcase file) uses a raw Tailwind default
// or a raw value where a token belongs. The rules, and why each exists, are in
// `scripts/lib/raw-tailwind.mjs`; `scripts/verify-no-raw-tailwind.test.mjs`
// proves each goes red on a fixture.
//
// Scope: `src/components/**` and `showcase/**`, `.ts`/`.tsx`/`.css`, minus tests
// (`*.test.*`) and examples (`*.examples.*`). Strings are read with the
// TypeScript scanner, so comments and JSX text never count.
//
// Usage: node scripts/verify-no-raw-tailwind.mjs [--root <dir>]
//   --root scans another tree with the same layout (the test's fixture).

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

import { allowFromTheme, scanCss, scanTs } from "./lib/raw-tailwind.mjs";
import { cssPackageSrc } from "./lib/themes.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > -1 ? resolve(process.argv[rootArg + 1]) : PKG;

// Token names that make a named default legal: this package's @theme, and the
// CSS package's. Always read from THIS package, so a fixture is judged by the
// real contract.
const themeCss = [readFileSync(join(PKG, "src", "tokens.css"), "utf8")];
const cssSrc = cssPackageSrc();
if (cssSrc) {
  for (const f of globSync("**/*.css", { cwd: cssSrc, absolute: true })) themeCss.push(readFileSync(f, "utf8"));
}
const allow = allowFromTheme(themeCss);

const scopes = ["src/components", "showcase"].map((d) => join(ROOT, d)).filter((d) => existsSync(d));
const files = scopes.flatMap((cwd) =>
  globSync("**/*.{ts,tsx,css}", {
    cwd,
    absolute: true,
    nodir: true,
    ignore: ["**/*.test.*", "**/*.examples.*", "**/dist/**", "**/node_modules/**", "vite.config.ts"],
  }),
);

const offenders = [];
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  const found = file.endsWith(".css") ? scanCss(source, allow) : scanTs(source, file, allow);
  for (const { line, problem } of found) offenders.push(`${relative(ROOT, file)}:${line}  ${problem}`);
}

if (offenders.length > 0) {
  console.error(
    `verify:no-raw-tailwind — ${offenders.length} raw value(s):\n` +
      offenders.map((o) => `  ${o}`).join("\n") +
      "\n\nComponents speak tokens only: `p-r3` not `p-4`, a text-scale token not `text-sm`,\n" +
      "`h-control` not `h-8`, a colour role not `bg-blue-500`. If no token fits, that is a\n" +
      "contract question for @batthewz/r-ui-css (or a domain token in src/tokens.css),\n" +
      "not an excuse.",
  );
  process.exit(1);
}

console.log(`verify:no-raw-tailwind — OK (${files.length} file(s) in ${scopes.map((s) => relative(ROOT, s)).join(", ")})`);
