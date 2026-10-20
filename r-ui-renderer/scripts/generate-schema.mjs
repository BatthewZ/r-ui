#!/usr/bin/env bun
// Writes `src/schema.json` (the `./schema.json` subpath) from the format's one
// JSON Schema source, `src/spec/validate-schema.ts`, which the validator and
// `./zod` read too. `--check` regenerates in memory and fails on a difference.
//
// Usage: bun scripts/generate-schema.mjs [--check] [--root <dir>]
//   Bun, because the source is TypeScript. --root writes into another tree with
//   the same layout (this script's test).

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { publishedSchema } from "../src/spec/validate-schema.ts";
import { PKG, pathArg } from "./lib/gate.mjs";

/** The file's whole text. */
export function schemaText() {
  return `${JSON.stringify(publishedSchema(), null, 2)}\n`;
}

/** Whether `root`'s `src/schema.json` differs from the source (a missing file differs). */
export function isStale(root) {
  try {
    return readFileSync(join(root, "src", "schema.json"), "utf8") !== schemaText();
  } catch {
    return true;
  }
}

function main() {
  const root = pathArg("--root", PKG);
  const path = join(root, "src", "schema.json");
  if (process.argv.includes("--check")) {
    if (isStale(root)) {
      console.error(`generate-schema --check — stale: ${relative(root, path)}\nRun \`bun scripts/generate-schema.mjs\`.`);
      process.exit(1);
    }
    console.log("generate-schema — OK");
    return;
  }
  writeFileSync(path, schemaText());
  console.log(`generate-schema — written ${relative(root, path)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
