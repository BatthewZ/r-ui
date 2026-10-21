// The machine-wide browser lock: one browser run at a time across every
// session sharing the machine. The holder writes who it is and when; a lock
// older than STALE_MS is taken to belong to a run that died without removing it.

import { mkdirSync, openSync, readFileSync, rmSync, statSync, writeSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_LOCK = join(homedir(), ".cache/r-ui-orchestration/browser.lock");
export const STALE_MS = 2 * 60 * 60 * 1000;

/** Creates `path` exclusively with `owner`; false when someone else holds a lock younger than `staleMs`. */
export function tryLock(path, owner, { now = Date.now(), staleMs = STALE_MS } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, `${owner} ${new Date(now).toISOString()}\n`);
      closeSync(fd);
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let age;
      try {
        age = now - statSync(path).mtimeMs;
      } catch {
        continue; // removed between the two calls: try again
      }
      if (age < staleMs) return false;
      rmSync(path, { force: true });
    }
  }
  return false;
}

/** Who holds `path`, as its holder wrote it; null when nobody does. */
export function lockHolder(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

/** Removes `path` only if `owner` holds it, so a run never removes a lock it lost to a stale take-over. */
export function releaseLock(path, owner) {
  if (lockHolder(path)?.startsWith(`${owner} `)) rmSync(path, { force: true });
}
