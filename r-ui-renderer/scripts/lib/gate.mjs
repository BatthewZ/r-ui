// Command-line plumbing shared by the verify-* gates.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** This package's root. */
export const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The path after `flag` on the command line, resolved; `fallback` without one. */
export function pathArg(flag, fallback) {
  const at = process.argv.indexOf(flag);
  return at > -1 ? resolve(process.argv[at + 1]) : fallback;
}
