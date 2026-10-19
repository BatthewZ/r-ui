#!/usr/bin/env node
// Asserts that every browser check carries valid header tags (the format is in
// `scripts/lib/browser-tags.mjs`), so `browser:check --group`, `--tier` and
// `--changed` can find it:
//   - `@covers` and `@tier` are present, the tier is one of sweep | page |
//     component, and `*` (every group) is a sweep's alone;
//   - each `@covers` group is a folder under `src/components/`, and a
//     `group/Name` entry is exported from that group's barrel;
//   - each `@sections` id is a section the showcase renders;
//   - each `@flags` value is known, `@cost` is a number of seconds, and no tag
//     is unknown or given twice;
//   - every component group has a component-tier script, or an entry in
//     UNCHECKED_GROUPS saying why none is needed (and loses the entry once it
//     has one).
//
// Usage: node scripts/verify-browser-tags.mjs [--root <dir>]
//   --root checks another tree with the same layout (the test's fixtures).

import { FLAGS, TIERS, componentGroups, coveredGroups, groupExports, loadScripts, sectionIds } from "./lib/browser-tags.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);

/** Groups with no component-tier browser script, each with the reason none is needed. */
const UNCHECKED_GROUPS = {
  guards:
    "RequireAuth draws no layout of its own; what it renders per status, every commit included (a MutationObserver), is RequireAuth.test.tsx's: jsdom commits as a browser does",
};

const scripts = loadScripts(ROOT);
const groups = componentGroups(ROOT);
const sections = sectionIds(ROOT);
if (scripts.length === 0 || groups.size === 0) {
  console.error(`verify:browser-tags — found ${scripts.length} script(s) and ${groups.size} group(s) under ${ROOT}; the scan is broken`);
  process.exit(1);
}

const problems = [];
for (const { name, tags } of scripts) {
  const say = (problem) => problems.push(`  ${name}.js: ${problem}`);
  tags.problems.forEach(say);
  if (!tags.has.covers || tags.covers.length === 0) say("no `// @covers <group>[, group/Component…]`");
  if (!tags.has.tier) say(`no \`// @tier ${TIERS.join(" | ")}\``);
  else if (!TIERS.includes(tags.tier)) say(`@tier "${tags.tier}" is not one of ${TIERS.join(" | ")}`);
  for (const entry of tags.covers) {
    if (entry === "*") {
      if (tags.tier !== "sweep") say("@covers * (every group) is for a sweep only");
      continue;
    }
    const [group, component, extra] = entry.split("/");
    if (extra !== undefined || !group) say(`@covers "${entry}" is not <group> or <group>/<Component>`);
    else if (!groups.has(group)) say(`@covers "${entry}": no group src/components/${group}/`);
    else if (component && !groupExports(ROOT, group, component)) say(`@covers "${entry}": ${group}'s index.ts exports no ${component}`);
  }
  for (const id of tags.sections) if (!sections.has(id)) say(`@sections "${id}" is no showcase section`);
  for (const flag of tags.flags) if (!FLAGS.includes(flag)) say(`@flags "${flag}" is not one of ${FLAGS.join(", ")}`);
  if (tags.has.cost && !(tags.cost > 0)) say("@cost is not a number of seconds");
}

const checked = new Set(scripts.filter((s) => s.tags.tier === "component").flatMap((s) => coveredGroups(s.tags.covers)));
for (const group of [...groups].sort()) {
  if (!checked.has(group) && !(group in UNCHECKED_GROUPS)) {
    problems.push(`  group "${group}" has no component-tier script (add one, or say why none is needed in UNCHECKED_GROUPS)`);
  }
  if (checked.has(group) && group in UNCHECKED_GROUPS) {
    problems.push(`  group "${group}" has a component-tier script: drop its UNCHECKED_GROUPS entry`);
  }
}

if (problems.length) {
  console.error(
    `verify:browser-tags — ${problems.length} problem(s):\n${problems.join("\n")}\n\n` +
      "Each scripts/browser/*.js opens with `// @covers …`, `// @tier …` and, as they apply,\n" +
      "`// @sections …`, `// @flags …` and `// @cost …` (format: scripts/lib/browser-tags.mjs).",
  );
  process.exit(1);
}
console.log(`verify:browser-tags — OK (${scripts.length} scripts, ${checked.size} of ${groups.size} groups with a component check)`);
