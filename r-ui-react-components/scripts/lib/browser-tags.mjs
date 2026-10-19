// The browser checks' header tags, and what the runner selects by them.
//
// Each `scripts/browser/*.js` opens with a comment header holding:
//
//   // @covers   form, form/PasswordInput     groups (or group/Component) it proves; `*` for a sweep over all
//   // @sections form-passwordinput          Overview section ids it opens (optional)
//   // @tier     component                   sweep | page | component
//   // @flags    timing touch                optional: timing (frame or ms windows), touch (dirties the session)
//   // @cost     45                          optional: seconds it takes, for sharding before a run has timed it
//
// Values are separated by spaces or commas. A long list continues on the lines
// right after its tag, each indented past `//` by two spaces or more:
//
//   // @sections marketing-hero marketing-carousel
//   //           marketing-footer `verify:browser-tags` holds every
// script to this; `browser-check.mjs` selects by it (`--group`, `--tier`,
// `--changed`). What a script visits besides sections (the Dashboard, Marketing
// or Stress page; print) is read from its source, so it cannot drift from a tag.

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { globSync } from "glob";

import { dependants } from "./group-graph.mjs";

export const TIERS = ["sweep", "page", "component"];
export const FLAGS = ["timing", "touch"];
const TAGS = ["covers", "sections", "tier", "flags", "cost"];
/** The showcase's pages a script can visit by hash; `solo` and `overview` both render sections. */
const PAGES = ["overview", "solo", "dashboard", "marketing", "stress"];

/**
 * A script's tags, from the comment lines before its `async (page) =>`, plus
 * what its source shows it visits. `problems` lists what is malformed in the
 * header itself (an unknown tag, a tag given twice).
 */
export function parseTags(source) {
  const header = source.slice(0, Math.max(0, source.search(/^async\s*\(/m)));
  const found = {};
  const problems = [];
  let open = null; // the tag a continuation line adds to
  for (const line of header.split("\n")) {
    const tag = /^\/\/\s*@(\w+)\b[ \t]*(.*)$/.exec(line);
    const more = tag ? null : /^\/\/[ \t]{2,}([^@\s].*)$/.exec(line);
    if (more && open) {
      open.push(...more[1].split(/[\s,]+/).filter(Boolean));
      continue;
    }
    open = null;
    if (!tag) continue;
    const [, name, value] = tag;
    if (!TAGS.includes(name)) problems.push(`unknown tag @${name}`);
    else if (name in found) problems.push(`@${name} given twice`);
    else open = found[name] = value.split(/[\s,]+/).filter(Boolean);
  }
  // A hash (`#/dashboard`) or a page named in a list the script walks (`["dashboard", …]`).
  const pages = PAGES.filter((p) => new RegExp(`#/${p}\\b|["'\`]${p}["'\`]`).test(source));
  return {
    covers: found.covers ?? [],
    sections: found.sections ?? [],
    tier: found.tier ? found.tier.join(" ") : null,
    flags: found.flags ?? [],
    cost: found.cost ? Number(found.cost.join(" ")) : null,
    has: Object.fromEntries(TAGS.map((t) => [t, t in found])),
    pages,
    prints: /media:\s*["']print["']/.test(source),
    problems,
  };
}

/** The groups a `@covers` list names (`form/PasswordInput` is `form`); `*` stays `*`. */
export const coveredGroups = (covers) => [...new Set(covers.map((c) => c.split("/")[0]))];

/** Every browser script under `root` with its tags, sorted by name. */
export function loadScripts(root) {
  return globSync("scripts/browser/*.js", { cwd: root, absolute: true })
    .sort()
    .map((file) => ({ file, name: basename(file, ".js"), tags: parseTags(readFileSync(file, "utf8")) }));
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The Overview section id of a `showcase/sections/<group>/<Name>.tsx` path (the showcase's `sectionIdOf`). */
export function sectionIdOf(path) {
  const m = /sections\/([^/]+)\/([^/]+)\.tsx$/.exec(path.split("\\").join("/"));
  return m ? `${slug(m[1])}-${slug(m[2])}` : null;
}

/** Every section id the showcase under `root` renders. */
export const sectionIds = (root) =>
  new Set(globSync("showcase/sections/*/*.tsx", { cwd: root, ignore: ["**/*.test.*", "**/*.examples.*"] }).map(sectionIdOf));

/** The component groups under `root` (`src/components/<group>/`). */
export const componentGroups = (root) => new Set(globSync("src/components/*/", { cwd: root }).map((d) => basename(d)));

/** Whether `group`'s barrel exports `name`. */
export function groupExports(root, group, name) {
  const barrel = join(root, "src/components", group, "index.ts");
  return existsSync(barrel) && new RegExp(`\\b${name}\\b`).test(readFileSync(barrel, "utf8"));
}

/**
 * Picks scripts. Each kind of criterion narrows (they AND); the values within one
 * kind widen (they OR). `names` match inside a file name, `groups` against the
 * groups `@covers` names (a `*` sweep is reached by its tier, not by a group),
 * `tiers` against `@tier`.
 */
export function selectScripts(scripts, { names = [], groups = [], tiers = [] } = {}) {
  return scripts.filter(({ name, tags }) => {
    const covered = coveredGroups(tags.covers);
    if (names.length && !names.some((n) => name.includes(n))) return false;
    if (groups.length && !groups.some((g) => covered.includes(g))) return false;
    if (tiers.length && !tiers.includes(tags.tier)) return false;
    return true;
  });
}

const SHARED_SRC = /^src\/(hooks|util)\//;
const HARNESS = [
  /^scripts\/browser-check\.mjs$/,
  /^scripts\/lib\/(browser-prelude\.js|browser-tags\.mjs|session-memory\.mjs)$/,
  /^showcase\/(shell|registry\.ts|main\.tsx|index\.html|vite\.config\.ts|[^/]+\.css$)/,
  /^package\.json$/,
];
/** Paths no browser check can see (unit tests aside): docs, the other gates, build output. */
const INERT = [
  /\.md$/,
  /^(memory|dist|showcase\/dist|node_modules)\//,
  /^scripts\/(fixtures\/|verify-|lib\/)/,
  /^(eslint\.config\.js|tsconfig\.json|vitest\.config\.ts|vite\.config\.ts|test-setup\.ts)$/,
  /^\.\.\/(?!r-ui-css\/|r-ui-tw-merge\/)/,
];

/**
 * What a change set (paths relative to the package; `../r-ui-css/…` for the
 * packages beside it) asks the browser checks to run: a map of script name →
 * the reasons it was picked. A component change runs every script covering its
 * group or a group that depends on it (`graph` is `groupGraph`'s); a hook or
 * util change runs its dependants; a token, global stylesheet or CSS-package
 * change runs everything. A section file runs the scripts that open it, a page
 * the scripts that visit it, a script itself. Anything that reaches a browser
 * also runs the sweep tier. `notes` says what else to do (a harness change:
 * run one script alone first).
 */
export function selectForChanges(paths, scripts, graph) {
  const picked = new Map();
  const notes = new Set();
  const pick = (script, reason) => {
    if (!picked.has(script.name)) picked.set(script.name, new Set());
    picked.get(script.name).add(reason);
  };
  const pickWhere = (test, reason) => scripts.filter(test).forEach((s) => pick(s, reason));
  const coversAny = (groups) => (s) => coveredGroups(s.tags.covers).some((g) => g === "*" || groups.includes(g));
  let sweep = false;
  const harness = [];

  for (const path of paths) {
    if (/\.test\.[^/]+$/.test(path)) continue;
    if (INERT.some((re) => re.test(path)) && !HARNESS.some((re) => re.test(path))) continue;
    sweep = true;
    let m;
    if (/^\.\.\/(r-ui-css|r-ui-tw-merge)\//.test(path)) {
      pickWhere(() => true, `${path} (the CSS contract)`);
    } else if (HARNESS.some((re) => re.test(path))) {
      harness.push(path);
    } else if ((m = /^scripts\/browser\/([^/]+)\.js$/.exec(path))) {
      pickWhere((s) => s.name === m[1], path);
    } else if ((m = /^src\/components\/([^/]+)\//.exec(path))) {
      const groups = dependants(graph, [m[1]]).filter((g) => g !== "index");
      pickWhere(coversAny(groups), `${path} → ${groups.join(", ")}`);
    } else if ((m = SHARED_SRC.exec(path))) {
      const groups = dependants(graph, [m[1]]).filter((g) => !["index", "hooks", "util"].includes(g));
      pickWhere(coversAny(groups), `${path} → ${groups.length} dependent group(s)`);
    } else if (path === "src/print.css") {
      pickWhere((s) => s.tags.prints, `${path} (prints)`);
    } else if (path.startsWith("src/")) {
      pickWhere(() => true, `${path} (shared by every component)`);
    } else if ((m = /^showcase\/sections\/([^/]+)\//.exec(path))) {
      const id = sectionIdOf(path);
      const own = id && scripts.some((s) => s.tags.sections.includes(id));
      // A section's helper (not itself a section: parts, art) is read by the sections beside it.
      if (own) pickWhere((s) => s.tags.sections.includes(id), path);
      else pickWhere((s) => s.tags.sections.some((x) => x.startsWith(`${slug(m[1])}-`)), path);
    } else if ((m = /^showcase\/pages\/([A-Za-z]+)/.exec(path))) {
      const page = m[1].toLowerCase();
      if (page === "overview") pickWhere((s) => s.tags.sections.length > 0 || s.tags.pages.includes("overview"), path);
      else pickWhere((s) => s.tags.pages.includes(page), path);
    } else {
      notes.add(`${path} maps to no script: the sweep tier covers it`);
    }
  }
  if (sweep) pickWhere((s) => s.tags.tier === "sweep", "sweep tier (runs with every change)");
  if (harness.length) notes.add(`the harness changed (${harness.join(", ")}): run one script alone through it before the rest`);
  return { picked, notes: [...notes] };
}
