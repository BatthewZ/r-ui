// Command-line plumbing shared by the check scripts.
import { fileURLToPath, pathToFileURL } from "node:url";

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

/** True when the module at `moduleUrl` is the script node was started with. */
export const isMain = (moduleUrl) => Boolean(process.argv[1]) && moduleUrl === pathToFileURL(process.argv[1]).href;
