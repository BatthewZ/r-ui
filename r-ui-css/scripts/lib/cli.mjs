// Command-line plumbing shared by the check scripts.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** This package's root, the default `--pkg`. */
export const PKG_DIR = fileURLToPath(new URL("../..", import.meta.url));

/** `[--pkg <dir>] [extra-theme.css ...]` -> `{ pkg, extra }`. */
export function parseArgs(argv) {
  let pkg = PKG_DIR;
  const extra = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pkg") pkg = argv[++i];
    else extra.push(argv[i]);
  }
  return { pkg, extra };
}

/**
 * True when the module at `moduleUrl` is the script node was started with. Compared as
 * real paths: node resolves the module's URL through symlinks but leaves `argv[1]` as typed,
 * and a package installed as a symlink (bun's isolated linker, pnpm) would otherwise never run.
 */
export function isMain(moduleUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
