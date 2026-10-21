#!/usr/bin/env bun
// Writes VIEWSPEC.md's GENERATED regions from the contracts, through the same
// renderer `./reference` ships, and `src/reference/prose.json`: the document's
// hand-written half (regions empty), which `renderViewSpecReference` renders
// from. Edit the prose in VIEWSPEC.md, then run this. `--check` regenerates in
// memory and fails on any difference, naming the stale file.
//
// Usage: bun scripts/gen-viewspec.mjs [--check] [--root <dir>]
//   Bun, because the renderer is TypeScript. --root reads and writes another
//   tree with the same layout (this script's test).

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { renderDocument } from "../src/reference/document.ts";
import { emptyRegions } from "../src/reference/regions.ts";
import { PKG, pathArg } from "./lib/gate.mjs";

const VIEWSPEC = "VIEWSPEC.md";
const PROSE = join("src", "reference", "prose.json");

/** One line per array entry, so a prose edit diffs as that line. */
const proseJson = (prose) => `[\n${prose.split("\n").map((line) => `  ${JSON.stringify(line)}`).join(",\n")}\n]\n`;

/** Every file this script writes under `root`, and what it should hold. */
export function generate(root) {
  const prose = emptyRegions(readFileSync(join(root, VIEWSPEC), "utf8"));
  return { [VIEWSPEC]: renderDocument(prose), [PROSE]: proseJson(prose) };
}

/** The files under `root` that differ from a fresh generation (a missing file differs). */
export function staleFiles(root) {
  return Object.entries(generate(root))
    .filter(([file, text]) => {
      try {
        return readFileSync(join(root, file), "utf8") !== text;
      } catch {
        return true;
      }
    })
    .map(([file]) => file);
}

function main() {
  const root = pathArg("--root", PKG);
  if (process.argv.includes("--check")) {
    const stale = staleFiles(root);
    if (stale.length > 0) {
      console.error(
        `gen-viewspec --check — stale: ${stale.join(", ")}\n` +
          "Edit prose in VIEWSPEC.md only (never inside a GENERATED region), then run `bun run derive:viewspec`.",
      );
      process.exit(1);
    }
    console.log("gen-viewspec — OK");
    return;
  }
  for (const [file, text] of Object.entries(generate(root))) writeFileSync(join(root, file), text);
  console.log(`gen-viewspec — written ${relative(root, join(root, VIEWSPEC))} and ${PROSE}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
