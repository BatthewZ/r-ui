#!/usr/bin/env node
// Asserts that no component (and no showcase file) uses a raw Tailwind default
// or a raw value where a token belongs. The rules, and why each exists, are in
// `scripts/lib/raw-tailwind.mjs`; `scripts/verify-no-raw-tailwind.test.mjs`
// proves each goes red on a fixture.
//
// Scope: `src/**` and `showcase/**`, `.ts`/`.tsx`/`.css`, minus tests
// (`*.test.*`), `src/tokens.css` (it declares the raw values tokens stand for),
// the showcase's own themes (`showcase/themes/`: the same, for a consumer; held
// to the theme gates by verify:showcase-themes) and the showcase's example data
// (`showcase/**/*.examples.*`: a user's brand palette is values, not styling).
// Everything else under `src/` is scanned like a component: `util`'s error line
// and tones, the shared stylesheets, and the hooks (a geometry default such as
// an observer's margin is a raw value too; a hook takes it as a parameter
// instead). Both exemptions stop at the showcase: under `src/` an `.examples.`
// file or a `themes/` stylesheet is scanned like any other.
// Strings are read with the TypeScript scanner, so comments and JSX text never
// count.
//
// ALLOWANCES lists the only findings that stand, each one exact declaration in
// one file with its reason. Adding one needs a reason no token can answer; a
// near-copy elsewhere is still reported.
//
// Usage: node scripts/verify-no-raw-tailwind.mjs [--root <dir>]
//   --root scans another tree with the same layout (the test's fixture).

import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { globSync } from "glob";

import { PKG, pathArg } from "./lib/gate.mjs";
import { allowFromTheme, scanCss, scanTs } from "./lib/raw-tailwind.mjs";
import { cssPackageSrc } from "./lib/themes.mjs";

const ROOT = pathArg("--root", PKG);

// Token names that make a named default legal: this package's @theme, and the
// CSS package's. Always read from THIS package, so a fixture is judged by the
// real contract.
const themeCss = [readFileSync(join(PKG, "src", "tokens.css"), "utf8")];
const cssSrc = cssPackageSrc();
if (cssSrc) {
  for (const f of globSync("**/*.css", { cwd: cssSrc, absolute: true })) themeCss.push(readFileSync(f, "utf8"));
}
const allow = allowFromTheme(themeCss);

const ALLOWANCES = [
  {
    file: "src/components/overlays/styles.css",
    problem: "raw length 100vw in `max-inline-size: min(var(--r-overlays-measure, var(--MEASURE)), 100vw - 2 * var(--R-SIZE-2));`",
    // Promoted, the cap is `100%` of the top layer's scrollbar-free viewport; this is
    // the in-place fallback, whose containing block is an ancestor.
    why: "an unpromoted floating panel's cap: only a viewport unit names the viewport from inside an ancestor",
  },
];
const allowed = (file, problem) => ALLOWANCES.some((a) => a.file === file && a.problem === problem);

const scopes = [
  ["src", ["tokens.css"]],
  ["showcase", ["**/*.examples.*", "themes/**"]],
]
  .map(([d, extra]) => [join(ROOT, d), extra])
  .filter(([d]) => existsSync(d));
const files = scopes.flatMap(([cwd, extra]) =>
  globSync("**/*.{ts,tsx,css}", {
    cwd,
    absolute: true,
    nodir: true,
    ignore: ["**/*.test.*", "**/dist/**", "**/node_modules/**", "vite.config.ts", ...extra],
  }),
);

const offenders = [];
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  const found = file.endsWith(".css") ? scanCss(source, allow) : scanTs(source, file, allow);
  const rel = relative(ROOT, file);
  for (const { line, problem } of found) if (!allowed(rel, problem)) offenders.push(`${rel}:${line}  ${problem}`);
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

console.log(`verify:no-raw-tailwind — OK (${files.length} file(s) in ${scopes.map(([s]) => relative(ROOT, s)).join(", ")})`);
