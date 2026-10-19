// Memory and processes of one playwright-cli session, for `browser:check` (Linux /proc).
//
// Each session is its own daemon (`run-cli-server --daemon-session=…/<name>.session`)
// with its own Chromium under it, so the session's footprint is that process tree.
// PSS splits shared pages between the processes that map them, so the tree's sum
// is what the session really costs; a renderer's RSS is what one page holds.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const kb = (text, field) => Number(new RegExp(`^${field}:\\s+(\\d+) kB`, "m").exec(text)?.[1] ?? 0);

/** The session's daemon and every process under it, with each one's args. */
function sessionTree(session) {
  const rows = execFileSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8" })
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .filter(Boolean)
    .map(([, pid, ppid, args]) => ({ pid: Number(pid), ppid: Number(ppid), args }));
  const root = rows.find((r) => r.args.includes("run-cli-server") && r.args.includes(`/${session}.session`));
  if (!root) return [];
  const tree = [root];
  for (let i = 0; i < tree.length; i++) for (const r of rows) if (r.ppid === tree[i].pid) tree.push(r);
  return tree;
}

/** The pids of the session's daemon and its browser, for stopping a session that no longer answers. */
export const sessionPids = (session) => sessionTree(session).map((r) => r.pid);

/** `{ sessionPssMb, rendererRssMb }` now (the largest page renderer), or null when the session is gone. */
export function sampleSessionMemory(session) {
  const tree = sessionTree(session);
  if (tree.length === 0) return null;
  let pss = 0;
  let renderer = 0;
  for (const { pid, args } of tree) {
    try {
      pss += kb(readFileSync(`/proc/${pid}/smaps_rollup`, "utf8"), "Pss");
      if (args.includes("--type=renderer") && !args.includes("--top-chrome-webui")) {
        renderer = Math.max(renderer, kb(readFileSync(`/proc/${pid}/status`, "utf8"), "VmRSS"));
      }
    } catch {
      /* exited between ps and the read */
    }
  }
  return { sessionPssMb: Math.round(pss / 1024), rendererRssMb: Math.round(renderer / 1024) };
}
