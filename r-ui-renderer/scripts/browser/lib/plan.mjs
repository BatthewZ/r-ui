// What `browser:check` runs, and where: the command line, the scripts' header
// tags, the selection (names, groups, changed files), and the split across
// browser sessions. Pure, so its tests need no browser.
//
// Each `scripts/browser/*.js` opens with a comment header:
//
//   // @covers   corpus, stream          groups it proves (`--group` selects by them)
//   // @flags    timing                  optional: timing (frame windows; runs alone after the shards)
//   // @cost     40                      optional: seconds it takes, for packing the shards

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { globSync } from "glob";

export const FLAGS = ["timing"];
const TAGS = ["covers", "flags", "cost"];
/** Seconds a script is assumed to take when it declares no `@cost`. */
export const DEFAULT_COST = 20;
/** One session's peak (daemon + Chromium, one full-page view at a time), and what the machine keeps back. */
export const SESSION_GB = 1.0;
export const RESERVE_GB = 1.5;
export const MAX_SHARDS = 4;

/** The command line: name filters, `--flag value` / `--flag=value`, and switches. */
export function parseArgs(argv) {
  const opts = { names: [], groups: [], changed: null, list: false, print: null, target: "development", shards: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => inline ?? argv[++i] ?? "";
    if (flag === "--group") opts.groups.push(...value().split(",").filter(Boolean));
    else if (flag === "--changed") opts.changed = inline || "HEAD";
    else if (flag === "--list") opts.list = true;
    else if (flag === "--print") opts.print = value();
    else if (flag === "--shards") {
      const n = Number(value());
      if (!Number.isSafeInteger(n) || n < 1) throw new Error("--shards takes a whole number of at least 1");
      opts.shards = n;
    } else if (flag === "--dev" || flag === "--production") {
      if (opts.target !== "development") throw new Error("--dev and --production exclude each other");
      opts.target = flag.slice(2);
    } else if (flag.startsWith("--")) throw new Error(`unknown option ${flag}`);
    else opts.names.push(argv[i]);
  }
  return opts;
}

/** A script's tags, from its leading comment lines; `problems` lists what is malformed. */
export function parseTags(source) {
  const lines = source.split("\n");
  const end = lines.findIndex((line) => !line.startsWith("//"));
  const found = {};
  const problems = [];
  for (const line of lines.slice(0, end === -1 ? lines.length : end)) {
    const tag = /^\/\/\s*@(\w+)\b[ \t]*(.*)$/.exec(line);
    if (!tag) continue;
    const [, name, value] = tag;
    if (!TAGS.includes(name)) problems.push(`unknown tag @${name}`);
    else if (name in found) problems.push(`@${name} given twice`);
    else found[name] = value.split(/[\s,]+/).filter(Boolean);
  }
  const flags = found.flags ?? [];
  for (const flag of flags) if (!FLAGS.includes(flag)) problems.push(`unknown flag ${flag}`);
  if (!found.covers?.length) problems.push("no @covers");
  if (!/^async\s*\(page\)\s*=>/m.test(source)) problems.push("not an `async (page) => …` expression");
  const cost = found.cost ? Number(found.cost.join(" ")) : null;
  if (cost !== null && !(cost > 0)) problems.push("@cost is not a positive number of seconds");
  return { covers: found.covers ?? [], flags, cost, problems };
}

/** Every browser script under `root`, with its tags, sorted by name. */
export function loadScripts(root) {
  return globSync("scripts/browser/*.js", { cwd: root, absolute: true })
    .sort()
    .map((file) => ({ file, name: basename(file, ".js"), tags: parseTags(readFileSync(file, "utf8")) }));
}

/** The scripts matching every given kind of criterion: a name containing a filter, a group it covers. */
export function selectScripts(scripts, { names = [], groups = [] }) {
  return scripts.filter(
    (script) =>
      (names.length === 0 || names.some((n) => script.name.includes(n))) &&
      (groups.length === 0 || groups.some((g) => script.tags.covers.includes(g))),
  );
}

/** Paths (relative to the package) whose change can show in a browser: the renderer, the playground, the harness, the packages it renders. */
const REACHES_ALL = [/^src\/(?!.*\.test\.)/, /^playground\//, /^scripts\/browser\/lib\//, /^scripts\/browser-check\.mjs$/, /^\.\.\/r-ui-react-components\/src\//, /^\.\.\/r-ui-css\//];

/**
 * The scripts that `changed` (package-relative paths) can affect, each with why:
 * a changed check selects itself; a change the renderer, the playground, the
 * corpus or the harness can show selects every check (each renders through all of them).
 */
export function selectForChanges(changed, scripts) {
  const picked = new Map();
  const add = (name, why) => picked.set(name, [...(picked.get(name) ?? []), why]);
  for (const path of changed) {
    const own = /^scripts\/browser\/([^/]+)\.js$/.exec(path);
    if (own && scripts.some((s) => s.name === own[1])) add(own[1], "changed itself");
    else if (REACHES_ALL.some((pattern) => pattern.test(path))) for (const s of scripts) add(s.name, path);
  }
  return picked;
}

/** How many sessions the memory allows for `count` scripts: what is free less the reserve, per session, capped. */
export function shardCount(count, availableGb, asked = null) {
  const fits = Math.max(1, Math.floor((availableGb - RESERVE_GB) / SESSION_GB));
  return Math.max(1, Math.min(asked ?? fits, MAX_SHARDS, count || 1));
}

const costOf = (script, durations) => durations[script.name] ?? script.tags.cost ?? DEFAULT_COST;

/**
 * `shards`: n lists packed greedily, longest first, onto the lightest; `timing`:
 * the scripts that measure frame windows, run one by one after the shards, alone.
 */
export function planShards(scripts, n, durations = {}) {
  const shards = Array.from({ length: n }, () => ({ scripts: [], seconds: 0 }));
  const timing = scripts.filter((s) => s.tags.flags.includes("timing"));
  const packed = scripts
    .filter((s) => !s.tags.flags.includes("timing"))
    .sort((a, b) => costOf(b, durations) - costOf(a, durations) || a.name.localeCompare(b.name));
  for (const script of packed) {
    const lightest = shards.reduce((min, shard) => (shard.seconds < min.seconds ? shard : min));
    lightest.scripts.push(script);
    lightest.seconds += costOf(script, durations);
  }
  return { shards: shards.filter((shard) => shard.scripts.length > 0), timing };
}
