#!/usr/bin/env bun
// Runs the browser checks in `scripts/browser/*.js` against the playground's
// full-page route (`/?view=<name>`), where each corpus document renders alone.
//
// jsdom has no layout, no top layer, no inert, no hit testing and no real
// animation frames, so the claims that live there (a modal that takes the
// pointer, rows that shrink at compact, a stream that builds up frame by frame
// without remounting) are settled in a real browser.
//
// Runs on bun: it reads the corpus manifest from its TypeScript source, so the
// checks get the document names from the same place the unit tests do.
//
// The target: by default the playground is built in development mode (React's
// development build, so its warnings reach the console the checks collect)
// into this run's own folder and served by `vite preview`; `--production`
// builds the production bundle; `--dev` runs the dev server instead. Every run
// builds first, so a check never measures a build older than the source.
//
// Sessions: the selection is split across playwright-cli sessions ("shards"),
// as many as the free memory allows (capped), packed by recorded durations;
// scripts flagged `timing` run one by one after the shards, alone. A failed
// script runs again alone in a fresh session: passing then, it is FLAKY, which
// fails the run as a FAIL does. Every script runs with
// `scripts/browser/lib/prelude.js` in scope and is followed by its
// `resetPage`, pass or fail. Logs and the build go to
// node_modules/.cache/r-ui-renderer-browser-check/runs/<pid>/.
//
// The machine-wide browser lock (`R_UI_BROWSER_LOCK`, default
// ~/.cache/r-ui-orchestration/browser.lock) is taken before the first browser
// opens and removed when the last one closes; a run waits while another holds it.
//
// Usage: bun run browser:check [name-filter…] [--group g,…] [--changed[=<ref>]] [--list]
//                              [--dev | --production] [--shards n] [--print <name>]
//   name filters      scripts whose file name contains any of them
//   --group g,…       scripts whose `@covers` names one of the groups
//   --changed[=ref]   scripts the files changed since `ref` (default HEAD, untracked
//                     included) can affect; prints why; nothing affected is a pass
//   --list            print the selection and the plan, and stop
//   --shards n        n sessions instead of what the memory allows (capped at 4)
//   --print <name>    print the code `run-code` would get for one script, and stop
// Criteria of different kinds narrow each other; values within one kind widen.

import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { freemem } from "node:os";
import { dirname, join, relative } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

import { COVERAGE_EXAMPLES, PRODUCT_EXAMPLES } from "../src/examples/index.ts";
import { DEFAULT_LOCK, lockHolder, releaseLock, tryLock } from "./browser/lib/lock.mjs";
import { loadScripts, parseArgs, planShards, RESERVE_GB, SESSION_GB, selectForChanges, selectScripts, shardCount } from "./browser/lib/plan.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(PKG, "node_modules/.cache/r-ui-renderer-browser-check");
const DURATIONS = join(CACHE, "durations.json");
const RUN = join(CACHE, "runs", String(process.pid));
const LOGS = join(RUN, "logs");
const VITE = join(PKG, "node_modules/.bin/vite");
const CONFIG = "playground/vite.config.ts";
const LOCK = process.env.R_UI_BROWSER_LOCK || DEFAULT_LOCK;
const OWNER = `r-ui-renderer browser:check pid=${process.pid}`;
const LOCK_WAIT_MS = 30 * 60 * 1000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(`browser:check — ${e.message}`);
  process.exit(1);
}

const all = loadScripts(PKG);
const malformed = all.filter((s) => s.tags.problems.length > 0);
if (malformed.length > 0) {
  for (const s of malformed) console.error(`browser:check — ${s.name}: ${s.tags.problems.join("; ")}`);
  process.exit(1);
}
let chosen = opts.print ? all.filter((s) => s.name.includes(opts.print)) : selectScripts(all, opts);
let reasons = null;
if (opts.changed) {
  const git = (...args) => execFileSync("git", args, { cwd: PKG, encoding: "utf8" });
  const top = git("rev-parse", "--show-toplevel").trim();
  const fromTop = [...git("diff", "--name-only", opts.changed, "--").split("\n"), ...git("ls-files", "--others", "--exclude-standard", "--full-name").split("\n")];
  const changed = [...new Set(fromTop.filter(Boolean).map((p) => relative(PKG, join(top, p)).split("\\").join("/")))];
  reasons = selectForChanges(changed, all);
  chosen = chosen.filter((s) => reasons.has(s.name));
  console.log(`browser:check --changed=${opts.changed}: ${chosen.length} script(s)`);
}

/** Memory the kernel could hand out now, in GB. */
function availableGb() {
  try {
    const kb = /^MemAvailable:\s+(\d+) kB/m.exec(readFileSync("/proc/meminfo", "utf8"))?.[1];
    if (kb) return Number(kb) / 1024 / 1024;
  } catch {
    /* not Linux */
  }
  return freemem() / 1024 ** 3;
}

function readDurations() {
  try {
    return JSON.parse(readFileSync(DURATIONS, "utf8"));
  } catch {
    return {};
  }
}

const durations = readDurations();
const memory = availableGb();
const packable = chosen.filter((s) => !s.tags.flags.includes("timing")).length;
// The dev server compiles each module on first request: parallel sessions against a cold one time out.
const n = shardCount(packable, memory, opts.shards ?? (opts.target === "dev" ? 1 : null));
const plan = planShards(chosen, n, durations);

if (reasons || opts.list) {
  for (const { name, tags } of chosen) {
    const why = reasons?.get(name);
    console.log(`  ${name} [${tags.covers.join(", ")}]${why ? `  ← ${why.slice(0, 3).join("; ")}${why.length > 3 ? ` (+${why.length - 3})` : ""}` : ""}`);
  }
  if (opts.list) {
    plan.shards.forEach((shard, k) => console.log(`  shard ${k + 1} (~${Math.round(shard.seconds)}s): ${shard.scripts.map((s) => s.name).join(", ")}`));
    console.log(`  timing, after the shards: ${plan.timing.map((s) => s.name).join(", ") || "none"}`);
    process.exit(0);
  }
}
if (chosen.length === 0) {
  if (opts.changed) process.exit(0);
  console.error("browser:check — no scripts in scripts/browser/ match the selection");
  process.exit(1);
}

const corpus = { product: Object.keys(PRODUCT_EXAMPLES), coverage: Object.keys(COVERAGE_EXAMPLES) };
const prelude = readFileSync(join(PKG, "scripts/browser/lib/prelude.js"), "utf8");

/** The script's `async (page) => …`, called in a scope holding the run's constants and the prelude, then `resetPage` whatever happened. */
function wrap(file, home) {
  const source = readFileSync(file, "utf8").trim().replace(/;$/, "");
  return [
    "async (page) => {",
    `const BROWSER_CHECK_HOME = ${JSON.stringify(home)};`,
    `const CORPUS = ${JSON.stringify(corpus)};`,
    // playwright-cli's page waits for a navigation without limit, and a locator's wait for its own default.
    "page.setDefaultNavigationTimeout(30_000);",
    "page.setDefaultTimeout(15_000);",
    prelude,
    "let failed = false;",
    "let result;",
    "try {",
    `  result = await (${source}\n)(page);`,
    "} catch (error) {",
    "  failed = true;",
    "  throw error;",
    "} finally {",
    "  try {",
    "    await resetPage(page);",
    "  } catch (error) {",
    "    if (!failed) throw error;",
    "  }",
    "}",
    "return result;",
    "}",
  ].join("\n");
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

const port = await freePort();
const url = `http://localhost:${port}/`;
if (opts.print) {
  if (chosen.length !== 1) {
    console.error(`browser:check --print — "${opts.print}" matches ${chosen.length} scripts; name exactly one`);
    process.exit(1);
  }
  process.stdout.write(wrap(chosen[0].file, url));
  process.exit(0);
}

async function waitForServer(server, ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`the playground server exited (${server.exitCode}) before it was ready`);
    try {
      const res = await globalThis.fetch(url);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await sleep(250);
  }
  throw new Error(`the playground did not answer at ${url} within ${ms / 1000}s`);
}

async function takeLock() {
  const until = Date.now() + LOCK_WAIT_MS;
  let told = false;
  while (!tryLock(LOCK, OWNER)) {
    if (Date.now() > until) throw new Error(`the browser lock ${LOCK} is still held after ${LOCK_WAIT_MS / 60_000} minutes: ${lockHolder(LOCK)}`);
    if (!told) console.log(`browser:check — waiting for the browser lock (${lockHolder(LOCK) ?? "?"})`);
    told = true;
    await sleep(10_000);
  }
}

// The runs of processes that are gone; this run keeps only its logs when it ends.
for (const pid of readdirSafe(join(CACHE, "runs"))) {
  try {
    process.kill(Number(pid), 0);
  } catch {
    rmSync(join(CACHE, "runs", pid), { recursive: true, force: true });
  }
}
function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
// playwright-cli writes its snapshots and logs into the working directory.
const work = join(RUN, "work");
mkdirSync(work, { recursive: true });
mkdirSync(LOGS, { recursive: true });

/** A child process to completion, or killed after `timeout` ms: its exit code, what it printed, and whether it timed out. */
const exec = (cmd, args, { timeout = 0 } = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: work });
    let out = "";
    let timedOut = false;
    const timer = timeout ? setTimeout(() => ((timedOut = true), child.kill("SIGTERM")), timeout) : null;
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (e) => resolve({ code: 1, out: `${out}${e}`, timedOut }));
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, out, timedOut });
    });
  });

const prefix = `r-ui-renderer-browser-check-${process.pid}`;
const sessions = new Set();
const cli = async (session, ...args) => {
  const { code, out } = await exec("playwright-cli", [`-s=${session}`, ...args], { timeout: 60_000 });
  if (code !== 0) throw new Error(`playwright-cli ${args[0]} (${session}) exited ${code}: ${out.trim().slice(-500)}`);
  return out;
};
async function openSession(session) {
  sessions.add(session);
  await cli(session, "open", "about:blank");
  await cli(session, "resize", "1280", "900"); // VIEWPORT in the prelude, which every check is reset to
}
async function closeSession(session) {
  if (!sessions.delete(session)) return;
  await exec("playwright-cli", [`-s=${session}`, "close"], { timeout: 15_000 });
}

let server = null;
let serverLog = "";
let locked = false;
function stopEverything() {
  for (const session of sessions) {
    try {
      execFileSync("playwright-cli", [`-s=${session}`, "close"], { cwd: work, stdio: "ignore", timeout: 15_000 });
    } catch {
      /* already gone */
    }
  }
  sessions.clear();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
  if (locked) releaseLock(LOCK, OWNER);
  locked = false;
  for (const dir of [work, join(RUN, "build")]) rmSync(dir, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\nbrowser:check — ${signal}: closing every session and the server, releasing the lock`);
    stopEverything();
    process.exit(130);
  });
}

const costOf = (script) => durations[script.name] ?? script.tags.cost ?? 20;

/** One script in `session`: `{ name, ok, seconds, text }`. A script past four times its usual time (three minutes at least) is stopped and fails. */
async function runScript(session, script) {
  const started = Date.now();
  const limit = Math.max(180, 4 * costOf(script));
  const { out, timedOut } = await exec("playwright-cli", [`-s=${session}`, "run-code", wrap(script.file, url)], { timeout: limit * 1000 });
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  if (timedOut) return { name: script.name, ok: false, seconds, text: `${script.name} (${seconds}s)\nstopped after ${limit}s: the script hung\n` };
  // run-code exits 0 even when the snippet throws; the report says which.
  const error = out.match(/### Error\n([\s\S]*?)(?:\n### |$)/);
  const result = out.match(/### Result\n([\s\S]*?)(?:\n### |$)/);
  if (error || !result) return { name: script.name, ok: false, seconds, text: `${script.name} (${seconds}s)\n${(error?.[1] ?? out).trim()}\n` };
  const line = result[1].trim();
  return { name: script.name, ok: true, seconds, text: `${script.name} (${seconds}s)  ${line.length > 240 ? `${line.slice(0, 240)}…` : line}` };
}

/** `scripts` one after another in a session of its own (`label`), reopened after a failure. */
async function runSession(label, scripts) {
  const session = `${prefix}-${label}`;
  const log = join(LOGS, `${label}.log`);
  const results = [];
  const started = Date.now();
  let fresh = false;
  try {
    for (const script of scripts) {
      if (!fresh) {
        try {
          await closeSession(session);
          await openSession(session);
          fresh = true;
        } catch (e) {
          const result = { name: script.name, ok: false, seconds: 0, text: `${script.name}: the session did not open: ${e.message}\n` };
          results.push(result);
          appendFileSync(log, `FAIL ${result.text}\n`);
          console.log(`FAIL [${label}] ${result.text}`);
          continue;
        }
      }
      const result = await runScript(session, script);
      results.push(result);
      appendFileSync(log, `${result.ok ? "ok  " : "FAIL"} ${result.text}\n`);
      console.log(`${result.ok ? "ok  " : "FAIL"} [${label}] ${result.text}`);
      // A failure may have killed the session or left it anywhere.
      fresh = result.ok;
    }
  } finally {
    await closeSession(session);
  }
  return { label, results, seconds: (Date.now() - started) / 1000 };
}

const TARGETS = { development: "a development build under vite preview", production: "a production build under vite preview", dev: "the dev server" };
const target = opts.target;
const wallStart = Date.now();
const results = new Map();
let harnessError = null;
try {
  if (target !== "dev") {
    const built = Date.now();
    const outDir = join(RUN, "build");
    try {
      execFileSync(VITE, ["build", "--config", CONFIG, "--mode", target, "--outDir", outDir, "--emptyOutDir"], {
        cwd: PKG,
        env: { ...process.env, NODE_ENV: target },
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (e) {
      throw new Error(`the playground build failed:\n${`${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-3000)}`);
    }
    console.log(`browser:check — built the playground (${target}) in ${((Date.now() - built) / 1000).toFixed(1)}s`);
    server = spawn(VITE, ["preview", "--config", CONFIG, "--outDir", outDir, "--port", String(port), "--strictPort"], { cwd: PKG, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  } else {
    server = spawn(VITE, ["--config", CONFIG, "--port", String(port), "--strictPort"], { cwd: PKG, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  }
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));
  await waitForServer(server);

  await takeLock();
  locked = true;
  console.log(
    `browser:check — ${chosen.length} script(s) on ${TARGETS[target]}; memory ${memory.toFixed(1)} GB available, ${RESERVE_GB} GB kept back, ` +
      `~${SESSION_GB} GB a session → ${plan.shards.length} shard(s)${plan.timing.length ? `, then ${plan.timing.length} timing script(s) alone` : ""}`,
  );
  const record = (run) => {
    for (const r of run.results) results.set(r.name, { ...r, label: run.label });
  };
  (await Promise.all(plan.shards.map((shard, k) => runSession(String(k + 1), shard.scripts)))).forEach(record);
  if (plan.timing.length) record(await runSession("t", plan.timing));

  for (const script of chosen.filter((s) => !results.get(s.name)?.ok)) {
    const first = results.get(script.name);
    const [retry] = (await runSession("r", [script])).results;
    results.set(script.name, retry.ok ? { ...first, flaky: true, retry } : { ...retry, label: first?.label ?? "r" });
  }
} catch (e) {
  harnessError = e;
  console.log(`FAIL harness: ${e.message}\n${serverLog.slice(-2000)}`);
} finally {
  stopEverything();
}

const ordered = chosen.map((script) => [script.name, results.get(script.name)]);
const passed = ordered.filter(([, r]) => r?.ok && !r.flaky);
const flaky = ordered.filter(([, r]) => r?.flaky).map(([name]) => name);
const failed = ordered.filter(([, r]) => !r?.ok && !r?.flaky).map(([name]) => name);

const next = { ...durations };
for (const [name, r] of passed) next[name] = r.seconds;
mkdirSync(CACHE, { recursive: true });
writeFileSync(DURATIONS, `${JSON.stringify(next, null, 2)}\n`);

const summary = ordered.map(([name, r]) => (r ? `${r.flaky ? "FLAKY" : r.ok ? "ok  " : "FAIL"} [${r.label}] ${r.text.split("\n")[0]}` : `---- ${name} (not run)`));
writeFileSync(join(LOGS, "summary.log"), `${summary.join("\n")}\n`);
console.log(`\nbrowser:check — summary (${TARGETS[target]}, wall ${((Date.now() - wallStart) / 1000).toFixed(1)}s; logs in ${relative(PKG, LOGS)}/)`);
for (const name of flaky) console.log(`  FLAKY ${name}: failed in its session, passed alone. Fix it; it is not a pass.\n${results.get(name).text.split("\n").slice(1).join("\n")}`);
for (const name of failed) console.log(`  FAIL  ${name}`);
if (harnessError || failed.length || flaky.length) {
  const parts = [];
  if (harnessError) parts.push("the harness failed");
  if (failed.length) parts.push(`${failed.length} of ${chosen.length} failed: ${failed.join(", ")}`);
  if (flaky.length) parts.push(`${flaky.length} flaky: ${flaky.join(", ")}`);
  console.error(`browser:check — ${parts.join("; ")}`);
  process.exit(1);
}
console.log(`browser:check — OK (${chosen.length} script(s))`);
