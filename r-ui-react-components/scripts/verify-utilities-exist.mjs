#!/usr/bin/env node
// Asserts that every class a component or showcase file writes actually
// generates CSS.
//
// The CSS package removes Tailwind's default colour, text-size, radius, shadow,
// weight, leading, tracking and easing scales, so `font-bold`, `text-sm`,
// `rounded`, `leading-tight` or `bg-gray-100` compile to NOTHING: no error, no
// warning, just an element that silently loses its style. This gate loads the
// real Tailwind design system for each CSS entry and asks it for every token:
//
//   src/**       against the library entry a consumer builds
//                (`@batthewz/r-ui-css` + `src/styles.css`);
//   showcase/**  against `showcase/showcase.css`.
//
// A token Tailwind parses as a utility but cannot generate is dead. A token it
// does not recognise at all (a plain class such as `sc-shell`) must be a class
// selector in that entry's compiled CSS, or a `group`/`peer` marker; that is
// only checked where the string is written in a class context directly (see
// `scripts/lib/class-tokens.mjs`), because a constant reached by following an
// identifier may also hold labels. A class glued to `${…}` is always reported.
//
// Scope: `.ts`/`.tsx` under `src/` and `showcase/`, minus tests, examples,
// build output and vite configs. `scripts/verify-utilities-exist.test.mjs`
// proves it goes red on a fixture.
//
// Usage: node scripts/verify-utilities-exist.mjs [--root <dir>]
//   --root scans another tree with the same layout (the test's fixture),
//   judged against THIS package's CSS.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { __unstable__loadDesignSystem, compile } from "@tailwindcss/node";
import { globSync } from "glob";

import { classTokens } from "./lib/class-tokens.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > -1 ? resolve(process.argv[rootArg + 1]) : PKG;

const MARKER = /^(?:group|peer)(?:\/[\w-]+)?$/;

/** The CSS entries, keyed by the source folder they judge. */
const ENTRIES = {
  src: { base: PKG, css: `@import "@batthewz/r-ui-css";\n@import "./src/styles.css";\n` },
  showcase: { base: join(PKG, "showcase"), css: readFileSync(join(PKG, "showcase", "showcase.css"), "utf8") },
};

async function load({ base, css }) {
  const design = await __unstable__loadDesignSystem(css, { base });
  const compiler = await compile(css, { base, onDependency() {} });
  return { design, compiled: compiler.build([]) };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cssEscape = (s) => s.replace(/[^\w-]/g, (c) => `\\${c}`);
const hasClassRule = (compiled, cls) =>
  new RegExp(`\\.${escapeRe(cssEscape(cls))}(?![\\w-])`).test(compiled);

const offenders = [];
let checked = 0;
let fileCount = 0;

const folders = Object.entries(ENTRIES).flatMap(([folder, entry]) => {
  const dir = join(ROOT, folder);
  if (!existsSync(dir)) return [];
  const files = globSync("**/*.{ts,tsx}", {
    cwd: dir,
    absolute: true,
    nodir: true,
    ignore: ["**/*.test.*", "**/*.examples.*", "**/dist/**", "**/node_modules/**", "**/*.d.ts", "vite.config.ts"],
  }).sort();
  return files.length ? [{ entry, perFile: files.map((file) => ({ file, ...classTokens(readFileSync(file, "utf8"), file) })) }] : [];
});

// A class-named lookup table is direct where ANY file uses it as classes (an
// exported table is usually used elsewhere); see `scripts/lib/class-tokens.mjs`.
const usedAnywhere = new Set(folders.flatMap((f) => f.perFile.flatMap((p) => [...p.used])));
for (const t of folders.flatMap((f) => f.perFile.flatMap((p) => p.tokens))) {
  if (t.table && usedAnywhere.has(t.table)) t.direct = true;
}

for (const { entry, perFile } of folders) {
  fileCount += perFile.length;
  const { design, compiled } = await load(entry);

  const unique = [...new Set(perFile.flatMap((f) => f.tokens.filter((t) => !t.fragment).map((t) => t.token)))];
  const css = design.candidatesToCss(unique);
  const generated = new Map(unique.map((t, i) => [t, css[i] ?? null]));

  for (const { file, tokens } of perFile) {
    const where = (t) => `${relative(ROOT, file)}:${t.line}`;
    for (const t of tokens) {
      checked += 1;
      if (t.fragment) {
        offenders.push(`${where(t)}  dynamic class fragment \`${t.token}\` (Tailwind only sees whole literal class names)`);
        continue;
      }
      if (generated.get(t.token)) continue;
      if (design.parseCandidate(t.token).length > 0) {
        offenders.push(`${where(t)}  \`${t.token}\` generates no CSS`);
      } else if (t.direct && !MARKER.test(t.token) && !hasClassRule(compiled, t.token)) {
        offenders.push(`${where(t)}  \`${t.token}\` is neither a utility nor a class in the compiled CSS`);
      }
    }
  }
}

if (offenders.length > 0) {
  console.error(
    `verify:utilities-exist — ${offenders.length} dead class(es):\n` +
      offenders.map((o) => `  ${o}`).join("\n") +
      "\n\nThe CSS package removes Tailwind's default colour, text, radius, shadow, weight,\n" +
      "leading, tracking and easing scales, so these compile to nothing. Use the token\n" +
      "utility (`font-semibold`, `text-body-2`, `rounded-md`, `text-fg-muted`…).",
  );
  process.exit(1);
}

console.log(`verify:utilities-exist — OK (${checked} class token(s) in ${fileCount} file(s))`);
