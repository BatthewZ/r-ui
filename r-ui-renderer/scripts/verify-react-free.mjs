#!/usr/bin/env node
// Asserts that the subpaths a server, a worker or the CLI imports stay free of
// React and of the component library: `./spec`, `./stream`, `./reference`,
// `./zod`, `./examples` and the `r-ui-validate` bin. It walks each entry's
// module graph through every relative import, re-export and dynamic import,
// type-only ones included (a `.d.ts` that names React types makes a server
// consumer install them), and fails on:
//   - a bare import of react, react-dom, the component library, lucide-react,
//     the CSS packages, or zod outside `./zod`;
//   - any `.tsx` module, whose JSX imports React's runtime without a statement.
// Each entry must still be published under its subpath in package.json, so a
// rename cannot quietly drop it from the walk.
//
// Usage: node scripts/verify-react-free.mjs [--root <dir>]

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import ts from "typescript";

import { failWith, PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);

/** Subpath (or `bin:<name>`) -> source entry, and the bare packages it may import. */
const ENTRIES = [
  { name: "./spec", file: "src/spec/index.ts", allow: [] },
  { name: "./stream", file: "src/stream/index.ts", allow: [] },
  { name: "./reference", file: "src/reference/index.ts", allow: [] },
  { name: "./zod", file: "src/zod/index.ts", allow: ["zod"] },
  { name: "./examples", file: "src/examples/index.ts", allow: [] },
  { name: "bin:r-ui-validate", file: "src/cli/r-ui-validate.ts", allow: [] },
];

const BANNED = [
  "react",
  "react-dom",
  "@batthewz/r-ui-react-components",
  "@batthewz/r-ui-css",
  "@batthewz/r-ui-tw-merge",
  "lucide-react",
  "zod",
];

/** The package a bare specifier names (`react/jsx-runtime` -> `react`). */
function packageOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function resolveRelative(from, specifier) {
  const base = resolve(dirname(from), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => statSync(candidate, { throwIfNoEntry: false })?.isFile()) ?? null;
}

function importsOf(file) {
  const info = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
  return info.importedFiles.map((entry) => entry.fileName);
}

const problems = [];
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
let walked = 0;

for (const entry of ENTRIES) {
  if (entry.name.startsWith("bin:")) {
    if (!pkg.bin?.[entry.name.slice(4)]) problems.push(`${entry.name}: not in package.json "bin"`);
  } else if (!pkg.exports?.[entry.name]) {
    problems.push(`${entry.name}: not in package.json "exports"`);
  }
  const start = join(ROOT, entry.file);
  if (!existsSync(start)) {
    problems.push(`${entry.name}: entry ${entry.file} does not exist`);
    continue;
  }
  /** module -> the module that first imported it, to print the chain. */
  const parent = new Map([[start, null]]);
  const queue = [start];
  const chain = (file) => {
    const hops = [];
    for (let at = file; at !== null; at = parent.get(at)) hops.unshift(relative(ROOT, at));
    return hops.join(" -> ");
  };
  while (queue.length > 0) {
    const file = queue.shift();
    walked += 1;
    if (file.endsWith(".tsx")) problems.push(`${entry.name}: a .tsx module (JSX imports React): ${chain(file)}`);
    for (const specifier of importsOf(file)) {
      if (specifier.startsWith(".")) {
        const target = resolveRelative(file, specifier);
        if (target === null) problems.push(`${entry.name}: unresolved "${specifier}" in ${relative(ROOT, file)}`);
        else if (/\.tsx?$/.test(target) && !parent.has(target)) {
          parent.set(target, file);
          queue.push(target);
        }
        continue;
      }
      if (specifier.startsWith("node:")) continue;
      const name = packageOf(specifier);
      if (BANNED.includes(name) && !entry.allow.includes(name)) {
        problems.push(`${entry.name}: imports "${specifier}": ${chain(file)}`);
      }
    }
  }
}

if (walked === 0) {
  console.error("verify:react-free — walked no module; the scan is broken");
  process.exit(1);
}
if (problems.length > 0) {
  failWith(
    `verify:react-free — ${problems.length} problem(s)`,
    problems,
    "These subpaths run on servers and in the CLI. Move the React-side code under a module only the package root imports.",
  );
}
console.log(`verify:react-free — OK (${ENTRIES.length} entries, ${walked} module(s) walked)`);
