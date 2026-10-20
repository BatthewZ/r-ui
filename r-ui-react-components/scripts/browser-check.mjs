#!/usr/bin/env node
// Runs the browser checks in `scripts/browser/*.js` against the showcase.
//
// jsdom has no layout, no CSS, no top layer and no hit testing, so the claims
// that live there (row heights, hit areas, anchored panels, the whole Overview
// on every axis) are settled in a real browser.
//
// The target: by default the showcase is built in development mode (React's
// development build, so the warnings the checks collect, a duplicate key or a
// bad nesting, still reach the console) and served by `vite preview`: bundled
// chunks, as a consumer ships them, and no hot reload under a running check.
// `--production` builds and serves the production build; `--dev` runs against
// the dev server instead. Every run builds first (about a second), so a check
// never measures a build older than the source.
//
// Sessions: the selection is split across N playwright-cli sessions ("shards",
// `scripts/lib/browser-shards.mjs`: packed by recorded durations, touch scripts
// last), all against the one server; N defaults to what the memory allows, and
// the budget is printed. Scripts flagged `timing` run one by one after the
// shards, in a fresh session, with no other browser competing for the CPU. A
// session is reopened after a `touch` script or a failure. A failed script runs
// again, alone, in a fresh session: passing then, it is reported FLAKY, which
// fails the run as a FAIL does. Each shard writes its log; the merged results,
// sorted by name, go to `summary.log` (both under node_modules/.cache/r-ui-browser-check/logs).
//
// Every script runs with `scripts/lib/browser-prelude.js` in scope, and is
// followed by its `resetShowcase`, pass or fail, so one failing check cannot
// leave its View, emulation or viewport to the next. Not part of `check`: it
// needs a browser (`playwright-cli install-browser`).
//
// Usage: bun run browser:check [name-filter…] [--group g,…] [--tier t,…] [--changed[=<ref>]] [--list]
//                              [--dev | --production] [--shards n] [--shuffle seed] [--profile] [--all] [--seed n]
//   name filters      scripts whose file name contains any of them
//   --group g,…       scripts whose `@covers` names one of the groups
//   --tier t,…        scripts of a tier (sweep | page | component)
//   --changed[=ref]   scripts the files changed since `ref` (default HEAD, untracked
//                     files included) can reach, plus the sweep tier; prints why
//   --list            print the selection and stop (with --shards or --shuffle, the plan too)
//   --dev             the dev server instead of a build under `vite preview`
//   --production      a production build (React's production mode) under `vite preview`
//   --shards n        n sessions instead of what the memory allows (capped at 4, 3 with a sweep)
//   --shuffle seed    a seeded order inside every session (proves no script leans on another)
//   --profile         per-load time and requests, per-block time, reset, memory
//                     (--profile and --dev run one session unless --shards says otherwise)
//   --all             every `openSection` opens its sections among all the others
//                     (`#/all`) instead of alone (to prove a converted check equal on both)
//   --seed n          which View combinations the sweeps load fresh (`viewMatrix` in
//                     the prelude); by default it changes once a day, and is printed
// Criteria of different kinds narrow each other; values within one kind widen.
//        node scripts/browser-check.mjs --print <name>   (the code to `run-code` by hand)

import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { freemem } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { costOf, isTouch, planShards, RESERVE_GB, shardCount } from "./lib/browser-shards.mjs";
import { loadScripts, selectForChanges, selectScripts } from "./lib/browser-tags.mjs";
import { groupGraph } from "./lib/group-graph.mjs";
import { sampleSessionMemory, sessionPids } from "./lib/session-memory.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(PKG, "node_modules/.cache/r-ui-browser-check");
const DURATIONS = join(CACHE, "durations.json");
// Each run keeps its build, logs and playwright-cli working directory apart, so two runs never share a file.
const RUN = join(CACHE, "runs", String(process.pid));
const LOGS = join(RUN, "logs");
const VITE = join(PKG, "node_modules/.bin/vite");

/** The command line: name filters, `--flag value` / `--flag=value` lists, and switches. */
function parseArgs(argv) {
  const opts = {
    names: [],
    groups: [],
    tiers: [],
    changed: null,
    list: false,
    profile: false,
    all: false,
    print: null,
    seed: null,
    target: "development",
    shards: null,
    shuffle: null,
  };
  const list = (value) => value.split(",").filter(Boolean);
  const whole = (flag, text, min) => {
    const n = Number(text);
    if (!Number.isSafeInteger(n) || n < min) throw new Error(`${flag} takes a whole number${min ? ` of at least ${min}` : ""}`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => inline ?? argv[++i] ?? "";
    if (flag === "--group") opts.groups.push(...list(value()));
    else if (flag === "--tier") opts.tiers.push(...list(value()));
    else if (flag === "--changed") opts.changed = inline || "HEAD";
    else if (flag === "--list") opts.list = true;
    else if (flag === "--profile") opts.profile = true;
    else if (flag === "--all") opts.all = true;
    else if (flag === "--print") opts.print = value();
    else if (flag === "--seed") opts.seed = whole(flag, value(), 0);
    else if (flag === "--shards") opts.shards = whole(flag, value(), 1);
    else if (flag === "--shuffle") opts.shuffle = whole(flag, value(), 0);
    else if (flag === "--dev" || flag === "--production") {
      if (opts.target !== "development") throw new Error("--dev and --production exclude each other");
      opts.target = flag.slice(2);
    } else if (flag.startsWith("--")) throw new Error(`unknown option ${flag}`);
    else opts.names.push(argv[i]);
  }
  return opts;
}

/** Paths changed since `ref` (and untracked ones), relative to this package: `../r-ui-css/…` for its neighbours. */
function changedPaths(ref) {
  const git = (...args) => execFileSync("git", args, { cwd: PKG, encoding: "utf8" });
  const top = git("rev-parse", "--show-toplevel").trim();
  const fromTop = [...git("diff", "--name-only", ref, "--").split("\n"), ...git("ls-files", "--others", "--exclude-standard", "--full-name").split("\n")];
  return [...new Set(fromTop.filter(Boolean).map((p) => relative(PKG, join(top, p)).split("\\").join("/")))].sort();
}

/** Memory the kernel could hand out now, in GB (`MemAvailable`; free memory where there is no /proc). */
function availableGb() {
  try {
    const kb = /^MemAvailable:\s+(\d+) kB/m.exec(readFileSync("/proc/meminfo", "utf8"))?.[1];
    if (kb) return Number(kb) / 1024 / 1024;
  } catch {
    /* not Linux */
  }
  return freemem() / 1024 ** 3;
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function readDurations() {
  try {
    return JSON.parse(readFileSync(DURATIONS, "utf8"));
  } catch {
    return {};
  }
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(`browser:check — ${e.message}`);
  process.exit(1);
}
const profiling = opts.profile;
// One a day by default: a re-run the same day mounts the same combinations fresh.
const seed = opts.seed ?? Math.floor(Date.now() / 86_400_000);
const all = loadScripts(PKG);
let chosen = selectScripts(all, opts);
let reasons = null;
if (opts.changed) {
  const { picked, notes } = selectForChanges(changedPaths(opts.changed), all, groupGraph(PKG));
  chosen = chosen.filter((s) => picked.has(s.name));
  reasons = picked;
  console.log(`browser:check --changed=${opts.changed}: ${chosen.length} script(s)`);
  for (const note of notes) console.log(`  note: ${note}`);
}
if (opts.print) chosen = all.filter((s) => s.name.includes(opts.print));

const durations = readDurations();
const memory = availableGb();
const budget = shardCount(
  chosen.filter((s) => !s.tags.flags.includes("timing")),
  memory,
  // The dev server compiles each module on its first request: sessions in parallel against a cold one time out.
  opts.shards ?? (profiling || opts.target === "dev" ? 1 : null),
);
const plan = planShards(chosen, budget.n, { durations, shuffle: opts.shuffle });

if (reasons || opts.list) {
  for (const { name, tags } of chosen) {
    const why = reasons?.get(name);
    console.log(`  ${name} [${tags.tier}]${why ? `  ← ${[...why].slice(0, 3).join("; ")}${why.size > 3 ? ` (+${why.size - 3})` : ""}` : ""}`);
  }
  if (opts.list && (opts.shards !== null || opts.shuffle !== null)) {
    plan.shards.forEach((shard, k) => console.log(`  shard ${k + 1} (~${Math.round(shard.seconds)}s): ${shard.scripts.map((s) => s.name).join(", ")}`));
    console.log(`  timing, after the shards: ${plan.timing.map((s) => s.name).join(", ") || "none"}`);
  }
  if (opts.list) process.exit(0);
}
if (chosen.length === 0) {
  // Nothing a browser can see changed: not a failure.
  if (opts.changed) process.exit(0);
  console.error("browser:check — no scripts in scripts/browser/ match the selection");
  process.exit(1);
}

const prelude = readFileSync(join(PKG, "scripts/lib/browser-prelude.js"), "utf8");
/**
 * The script's `async (page) => …` expression, called inside a scope that holds
 * the prelude, then `resetShowcase` whether it passed or threw. A reset that
 * fails after a passing check fails it; after a failing one, the check's own
 * error is the one reported.
 */
const wrap = (file, { profile = false, all = false, seed = 0, target = "development" } = {}) => {
  const source = readFileSync(file, "utf8").trim().replace(/;$/, "");
  const script = profile ? markBlocks(source) : source;
  return [
    "async (page) => {",
    `const BROWSER_CHECK_PROFILE = ${profile};`,
    `const BROWSER_CHECK_ROUTE = ${JSON.stringify(all ? "all" : "solo")};`,
    `const BROWSER_CHECK_SEED = ${seed};`,
    `const BROWSER_CHECK_BUILT = ${target !== "dev"};`,
    // playwright-cli's page waits for a navigation without limit: a load event that never comes would hang the run.
    "page.setDefaultNavigationTimeout(30_000);",
    "page.context().setDefaultNavigationTimeout(30_000);",
    prelude,
    'const home = page.url().split("#")[0];',
    "let failed = false;",
    "let result;",
    "let report = null;",
    "startProfile(page);",
    "try {",
    `  result = await (${script}\n)(page);`,
    "} catch (error) {",
    "  failed = true;",
    "  throw error;",
    "} finally {",
    "  report = endProfile();",
    "  const resetAt = Date.now();",
    "  try {",
    "    await resetShowcase(page, home);",
    "  } catch (error) {",
    "    if (!failed) throw error;",
    "  }",
    "  if (report) report.resetMs = Date.now() - resetAt;",
    "}",
    "return report ? { result, profile: report } : result;",
    "}",
  ].join("\n");
};

const AsyncFunction = (async () => {}).constructor;
/**
 * Under --profile, a mark before each numbered block comment (`// 3. …`,
 * `// ── 3. …`, `// 1 + 5: …`), so the report times the script's own blocks. The
 * call is guarded because a comment can sit inside a callback that runs in the
 * page, where the prelude does not exist; one that sits where a statement cannot
 * (inside a literal) would break the script, which then runs unmarked.
 */
function markBlocks(source) {
  const marked = source.replace(
    /^([ \t]+)\/\/ (?:─+ )?(\d+[a-z]?(?:\s*[+,&]\s*\d+[a-z]?)*)[.:)] *([^\n]*)$/gm,
    (line, indent, n, text) =>
      `${indent}typeof markBlock === "function" && markBlock(${JSON.stringify(`${n}. ${text.replace(/[\s─]+$/, "").slice(0, 48)}`)});\n${line}`,
  );
  try {
    new AsyncFunction("page", `return (${marked})(page);`);
    return marked;
  } catch {
    return source;
  }
}

if (opts.print) {
  if (chosen.length !== 1) {
    console.error(`browser:check --print — "${opts.print}" matches ${chosen.length} scripts; name exactly one`);
    process.exit(1);
  }
  process.stdout.write(wrap(chosen[0].file, { all: opts.all, seed, target: opts.target }));
  process.exit(0);
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

/** Samples a session's memory every `ms` until `stop()`, which returns the peaks. */
function watchMemory(name, ms = 500) {
  const peak = { sessionPssMb: 0, rendererRssMb: 0 };
  const take = () => {
    const now = sampleSessionMemory(name);
    if (!now) return;
    peak.sessionPssMb = Math.max(peak.sessionPssMb, now.sessionPssMb);
    peak.rendererRssMb = Math.max(peak.rendererRssMb, now.rendererRssMb);
  };
  take();
  const timer = setInterval(take, ms);
  return {
    stop: () => {
      clearInterval(timer);
      take();
      return peak;
    },
  };
}

const s = (ms) => `${(ms / 1000).toFixed(1)}s`;
const gb = (mb) => `${(mb / 1024).toFixed(1)} GB`;
/** The --profile lines under a script's result, then the same as one JSON line for tools. */
function formatProfile(report, peak, seconds) {
  if (!report) return "     profile: none (the script returned no report)";
  const loadMs = report.loads.reduce((sum, l) => sum + l.ms, 0);
  const blockMs = Object.values(report.blocks).reduce((sum, ms) => sum + ms, 0);
  const loads = report.loads.map((l) => `${l.kind} ${l.route || "/"} ${s(l.ms)} ${l.requests}req`).join("; ");
  const blocks = Object.entries(report.blocks)
    .sort(([, a], [, b]) => b - a)
    .map(([label, ms]) => `${label} ${s(ms)}`)
    .join(" | ");
  return [
    `     loads: ${report.loads.length} in ${s(loadMs)}${loads ? ` (${loads})` : ""}`,
    `     blocks (${s(blockMs)}): ${blocks}`,
    `     reset ${s(report.resetMs)} · harness ${(seconds - blockMs / 1000 - report.resetMs / 1000).toFixed(1)}s · memory peak: renderer ${peak?.rendererRssMb ?? "?"} MB RSS, session ${peak?.sessionPssMb ?? "?"} MB PSS`,
    `     profile-json ${JSON.stringify({ seconds, ...report, memory: peak })}`,
  ].join("\n");
}

/** A child process to completion, or killed after `timeout` ms: its exit code, everything it printed, and whether it timed out. */
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
      clearTimeout(timer);
      resolve({ code, out, timedOut });
    });
  });

const target = opts.target;
const TARGETS = {
  development: "a development build under vite preview",
  production: "a production build under vite preview",
  dev: "the dev server",
};
const port = await freePort();
const url = `http://localhost:${port}/`;
const prefix = `r-ui-browser-check-${process.pid}`;
// playwright-cli writes its snapshots and logs into the working directory.
const work = join(RUN, "work");
// The runs of processes that are gone (a run removes all but its logs as it ends).
for (const pid of readdirSafe(join(CACHE, "runs"))) {
  try {
    process.kill(Number(pid), 0);
  } catch {
    rmSync(join(CACHE, "runs", pid), { recursive: true, force: true });
  }
}
mkdirSync(work, { recursive: true });
mkdirSync(LOGS, { recursive: true });

const sessions = new Set();
const cli = async (session, ...args) => {
  const { code, out } = await exec("playwright-cli", [`-s=${session}`, ...args], { timeout: 60_000 });
  if (code !== 0) throw new Error(`playwright-cli ${args[0]} (${session}) exited ${code}: ${out.trim().slice(-500)}`);
  return out;
};
async function openSession(session) {
  sessions.add(session);
  await cli(session, "open", `${url}#/blank`); // SHOWCASE_BLANK in the prelude: where every check starts
  await cli(session, "resize", "1280", "900"); // SHOWCASE_VIEWPORT in the prelude, which every check is reset to
}
/** Closes a session; one that does not answer (a script hung in it) has its daemon and browser killed. */
async function closeSession(session) {
  if (!sessions.delete(session)) return;
  const { code } = await exec("playwright-cli", [`-s=${session}`, "close"], { timeout: 15_000 });
  if (code !== 0) killSession(session);
}
function killSession(session) {
  for (const pid of sessionPids(session)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

let server = null;
let serverLog = "";
function stopEverything() {
  for (const session of sessions) {
    try {
      execFileSync("playwright-cli", [`-s=${session}`, "close"], { cwd: work, stdio: "ignore", timeout: 15_000 });
    } catch {
      killSession(session);
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
  for (const dir of [work, join(RUN, "build")]) rmSync(dir, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\nbrowser:check — ${signal}: closing every session and the server`);
    stopEverything();
    process.exit(130);
  });
}

/**
 * One script in `session`: `{ ok, seconds, text }`, where `text` is the line(s) to
 * print after the status. A script that runs past four times its usual time (three
 * minutes at least) is stopped and fails: a hang must not hold the run.
 */
async function runScript(session, script) {
  const { file, name } = script;
  const started = Date.now();
  const watch = profiling ? watchMemory(session) : null;
  const limit = Math.max(180, 4 * costOf(script, durations));
  const { out, timedOut } = await exec("playwright-cli", [`-s=${session}`, "run-code", wrap(file, { profile: profiling, all: opts.all, seed, target })], {
    timeout: limit * 1000,
  });
  const peak = watch?.stop();
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  if (timedOut) return { name, ok: false, seconds, text: `${name} (${seconds}s)\nstopped after ${limit}s: the script hung (its session is closed)\n` };
  // run-code exits 0 even when the snippet throws; the report says which.
  const error = out.match(/### Error\n([\s\S]*?)(?:\n### |$)/);
  const result = out.match(/### Result\n([\s\S]*?)(?:\n### |$)/);
  if (error || !result) return { name, ok: false, seconds, text: `${name} (${seconds}s)\n${(error?.[1] ?? out).trim()}\n` };
  let value = result[1].trim();
  try {
    value = JSON.parse(value);
  } catch {
    /* not JSON: print it as it came */
  }
  const report = profiling && value && typeof value === "object" ? value.profile : null;
  const line = String(report ? value.result : value);
  const text = `${name} (${seconds}s)  ${line.length > 240 ? `${line.slice(0, 240)}…` : line}`;
  return { name, ok: true, seconds, text: profiling ? `${text}\n${formatProfile(report, peak, seconds)}` : text };
}

/**
 * Runs `scripts` one after another in a session of its own, labelled `label`
 * (a shard's number, `t` for the timing tail, `r` for a re-run), reopening the
 * session after a touch script or a failure. Every script gets a result: one the
 * session could not run fails with the reason.
 */
async function runSession(label, scripts) {
  const session = `${prefix}-${label}`;
  const log = join(LOGS, `${label}.log`);
  const results = [];
  const started = Date.now();
  let peakMb = 0;
  const sampler = setInterval(() => (peakMb = Math.max(peakMb, sampleSessionMemory(session)?.sessionPssMb ?? 0)), 2_000);
  const say = (status, text) => {
    appendFileSync(log, `${status} ${text}\n`);
    console.log(`${status} [${label}] ${text}`);
  };
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
          say("FAIL", result.text);
          continue;
        }
      }
      const result = await runScript(session, script);
      results.push(result);
      say(result.ok ? "ok  " : "FAIL", result.text);
      // Fresh for the next one: touch emulation outlives the script, and a failure may have killed the session.
      if (isTouch(script) || !result.ok) fresh = false;
      else fresh = true;
    }
  } finally {
    clearInterval(sampler);
    await closeSession(session);
  }
  return { label, results, seconds: (Date.now() - started) / 1000, peakMb };
}

const wallStart = Date.now();
const results = new Map(); // name → { ok, flaky, seconds, text, label }
const sessionsRun = [];
let harnessError = null;
try {
  if (target !== "dev") {
    const built = Date.now();
    const outDir = join(RUN, "build");
    try {
      execFileSync(VITE, ["build", "--config", "showcase/vite.config.ts", "--mode", target, "--outDir", outDir, "--emptyOutDir", "--sourcemap"], {
        cwd: PKG,
        env: { ...process.env, NODE_ENV: target },
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (e) {
      throw new Error(`the showcase build failed:\n${`${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-3000)}`);
    }
    console.log(`browser:check — built the showcase (${target}) in ${s(Date.now() - built)}`);
    server = spawn(VITE, ["preview", "--config", "showcase/vite.config.ts", "--outDir", outDir, "--port", String(port), "--strictPort"], {
      cwd: PKG,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    server = spawn(VITE, ["--config", "showcase/vite.config.ts", "--port", String(port), "--strictPort"], { cwd: PKG, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  }
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));
  await waitForServer(url, server);

  const shards = plan.shards.filter((shard) => shard.scripts.length > 0);
  const capNote = budget.capped ? `, capped at ${budget.cap}${budget.tier === "sweep" ? " with a sweep" : ""}` : "";
  console.log(
    `browser:check — ${chosen.length} script(s) on ${TARGETS[target]}; seed ${seed} (--seed ${seed} repeats this run's fresh loads)` +
      `${opts.shuffle !== null ? `; shuffle ${opts.shuffle}` : ""}\n` +
      `browser:check — memory: ${memory.toFixed(1)} GB available, ${RESERVE_GB} GB kept back, ~${budget.perSessionGb} GB a session (heaviest tier: ${budget.tier})` +
      ` → room for ${budget.fits}; ${shards.length} shard(s)${opts.shards !== null ? ` (asked for ${opts.shards})` : ""}${capNote}` +
      `${plan.timing.length ? `, then ${plan.timing.length} timing script(s) one by one` : ""}`,
  );

  const record = (run) => {
    sessionsRun.push(run);
    for (const r of run.results) results.set(r.name, { ...r, label: run.label });
  };
  (await Promise.all(shards.map((shard, k) => runSession(String(k + 1), shard.scripts)))).forEach(record);
  if (plan.timing.length) record(await runSession("t", plan.timing));

  const failed = chosen.filter((script) => !results.get(script.name)?.ok);
  for (const script of failed) {
    const first = results.get(script.name);
    const again = await runSession("r", [script]);
    sessionsRun.push(again);
    const [retry] = again.results;
    results.set(script.name, retry.ok ? { ...first, flaky: true, retry } : { ...retry, label: first.label, firstText: first.text });
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
const failedNames = ordered.filter(([, r]) => !r?.ok && !r?.flaky).map(([name]) => name);

// Durations for the next run's packing: first attempts that passed.
const next = { ...durations };
for (const [name, r] of passed) next[name] = r.seconds;
writeFileSync(DURATIONS, `${JSON.stringify(next, null, 2)}\n`);

const summary = ordered.map(([name, r]) => {
  const status = !r ? "----" : r.flaky ? "FLAKY" : r.ok ? "ok  " : "FAIL";
  return r ? `${status} [${r.label}] ${r.text.split("\n")[0]}` : `${status} ${name} (not run)`;
});
writeFileSync(join(LOGS, "summary.log"), `${summary.join("\n")}\n`);
const wall = (Date.now() - wallStart) / 1000;
console.log(`\nbrowser:check — summary (${TARGETS[target]}, wall ${wall.toFixed(1)}s; logs in ${relative(PKG, LOGS)}/)`);
for (const run of sessionsRun.filter((r) => r.label !== "r")) {
  const what = run.label === "t" ? "timing" : `shard ${run.label}`;
  console.log(`  ${what}: ${run.results.length} script(s) in ${run.seconds.toFixed(1)}s, session peak ${run.peakMb ? gb(run.peakMb) : "?"}`);
}
for (const name of flaky) console.log(`  FLAKY ${name}: failed in its session, passed alone. Fix it; it is not a pass.\n${results.get(name).text.split("\n").slice(1).join("\n")}`);
for (const name of failedNames) console.log(`  FAIL  ${name}`);

if (harnessError || failedNames.length || flaky.length) {
  const parts = [];
  if (harnessError) parts.push("the harness failed");
  if (failedNames.length) parts.push(`${failedNames.length} of ${chosen.length} failed: ${failedNames.join(", ")}`);
  if (flaky.length) parts.push(`${flaky.length} flaky: ${flaky.join(", ")}`);
  console.error(`browser:check — ${parts.join("; ")}`);
  process.exit(1);
}
console.log(`browser:check — OK (${chosen.length} script(s))`);
