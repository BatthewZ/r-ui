// Command-line plumbing shared by the gates and the writers.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** This package's root. */
export const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The path after `flag` on the command line, resolved; `fallback` without one. */
export function pathArg(flag, fallback) {
  const at = process.argv.indexOf(flag);
  return at > -1 ? resolve(process.argv[at + 1]) : fallback;
}

/** Whether the module at `moduleUrl` (its `import.meta.url`) is the script node or bun was started with. */
export function isMain(moduleUrl) {
  return process.argv[1] !== undefined && fileURLToPath(moduleUrl) === process.argv[1];
}

/** A file's text, or undefined when it cannot be read (a missing file). */
export function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Prints `heading:` and each finding indented below it, then `hint` after a blank line, and exits 1. */
export function failWith(heading, findings, hint) {
  const list = findings.map((finding) => `  ${finding}`).join("\n");
  console.error(`${heading}:\n${list}${hint === undefined ? "" : `\n\n${hint}`}`);
  process.exit(1);
}
