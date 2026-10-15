#!/usr/bin/env node
// Runs every browser check in `scripts/browser/*.js` against a fresh showcase.
//
// jsdom has no layout, no CSS, no top layer and no hit testing, so the claims
// that live there (row heights, hit areas, anchored panels, the whole Overview
// on every axis) are settled in a real browser. This starts the showcase's dev
// server on a free port, opens one playwright-cli session, runs each script with
// `run-code`, then closes the session and stops the server, pass or fail.
//
// Not part of `check`: it needs a browser (`playwright-cli install-browser`).
// Usage: bun run browser:check [name-filter]

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const filter = process.argv[2];
const scripts = globSync("scripts/browser/*.js", { cwd: PKG, absolute: true })
  .sort()
  .filter((f) => !filter || basename(f).includes(filter));
if (scripts.length === 0) {
  console.error(`browser:check — no scripts in scripts/browser/${filter ? ` matching "${filter}"` : ""}`);
  process.exit(1);
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

async function waitForServer(url, server, ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`the showcase server exited (${server.exitCode}) before it was ready`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the showcase did not answer at ${url} within ${ms / 1000}s`);
}

const port = await freePort();
const url = `http://localhost:${port}/`;
const session = `r-ui-browser-check-${process.pid}`;
// playwright-cli writes its snapshots and logs into the working directory.
const work = mkdtempSync(join(tmpdir(), "r-ui-browser-check-"));
const cli = (...args) => execFileSync("playwright-cli", [`-s=${session}`, ...args], { cwd: work, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const server = spawn(join(PKG, "node_modules/.bin/vite"), ["--config", "showcase/vite.config.ts", "--port", String(port), "--strictPort"], {
  cwd: PKG,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

const failures = [];
let opened = false;
try {
  await waitForServer(url, server);
  cli("open", url);
  opened = true;
  cli("resize", "1280", "900");
  for (const file of scripts) {
    const name = basename(file, ".js");
    const started = Date.now();
    let out;
    try {
      out = cli("run-code", readFileSync(file, "utf8"));
    } catch (e) {
      out = `${e.stdout ?? ""}${e.stderr ?? ""}` || String(e);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    // run-code exits 0 even when the snippet throws; the report says which.
    const error = out.match(/### Error\n([\s\S]*?)(?:\n### |$)/);
    const result = out.match(/### Result\n([\s\S]*?)(?:\n### |$)/);
    if (error || !result) {
      failures.push(name);
      console.log(`FAIL ${name} (${seconds}s)\n${(error?.[1] ?? out).trim()}\n`);
    } else {
      const line = result[1].trim().replace(/^"|"$/g, "").replace(/\\"/g, '"');
      console.log(`ok   ${name} (${seconds}s)  ${line.length > 240 ? `${line.slice(0, 240)}…` : line}`);
    }
  }
} catch (e) {
  failures.push("harness");
  console.log(`FAIL harness: ${e.message}\n${serverLog.slice(-2000)}`);
} finally {
  if (opened) {
    try {
      cli("close");
    } catch {
      /* already gone */
    }
  }
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* already stopped */
  }
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`browser:check — ${failures.length} of ${scripts.length} failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`browser:check — OK (${scripts.length} script(s))`);
