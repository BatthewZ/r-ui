// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";
import { describe, expect, it } from "vitest";

import { sectionIdOf as showcaseSectionIdOf } from "../showcase/shell/sections.ts";
import { loadScripts, parseTags, sectionIdOf, sectionIds, selectForChanges, selectScripts } from "./lib/browser-tags.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const node = (...args) => spawnSync(process.execPath, args, { cwd: PKG, encoding: "utf8" });
const gate = (root) => node(join(HERE, "verify-browser-tags.mjs"), "--root", root);

// Each case runs a script as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:browser-tags", { timeout: 30_000 }, () => {
  it("goes red on a missing, unknown, repeated or invalid tag, and on a group with no component check", () => {
    const result = gate(join(HERE, "fixtures/browser-tags/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/— 13 problem\(s\)/);
    expect(out).toMatch(/untagged\.js: no `\/\/ @covers/);
    expect(out).toMatch(/untagged\.js: no `\/\/ @tier sweep \| page \| component`/);
    expect(out).toMatch(/wrong\.js: unknown tag @owner/);
    expect(out).toMatch(/wrong\.js: @tier given twice/);
    expect(out).toMatch(/wrong\.js: @tier "fast" is not one of sweep \| page \| component/);
    expect(out).toMatch(/wrong\.js: @covers "nogroup": no group src\/components\/nogroup\//);
    expect(out).toMatch(/wrong\.js: @covers "alpha\/Missing": alpha's index\.ts exports no Missing/);
    expect(out).toMatch(/wrong\.js: @covers "alpha\/Widget\/Part" is not <group> or <group>\/<Component>/);
    expect(out).toMatch(/wrong\.js: @sections "alpha-nothing" is no showcase section/);
    expect(out).toMatch(/wrong\.js: @flags "slow" is not one of timing, touch/);
    expect(out).toMatch(/wrong\.js: @cost is not a number of seconds/);
    expect(out).toMatch(/star\.js: @covers \* \(every group\) is for a sweep only/);
    expect(out).toMatch(/group "gamma" has no component-tier script/);
  });

  it("passes well-tagged scripts, a sweep over every group included", () => {
    const result = gate(join(HERE, "fixtures/browser-tags/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(3 scripts, 2 of 2 groups with a component check\)/);
  });
});

describe("browser-check selection", { timeout: 30_000 }, () => {
  const fixture = loadScripts(join(HERE, "fixtures/browser-tags/good"));
  const names = (list) => list.map((s) => s.name);

  it("reads every tag, separated by spaces or commas, and what the source visits", () => {
    const tags = parseTags(
      '// @covers a, b/Thing\n// @sections a-x a-y\n// @tier page\n// @flags touch\n// @cost 40\nasync (page) => { await page.goto(`${b}#/dashboard`); await page.emulateMedia({ media: "print" }); }',
    );
    expect(tags).toMatchObject({ covers: ["a", "b/Thing"], sections: ["a-x", "a-y"], tier: "page", flags: ["touch"], cost: 40, pages: ["dashboard"], prints: true, problems: [] });
  });

  it("continues a tag on the indented lines right after it, and nowhere else", () => {
    const tags = parseTags(
      "// @covers a\n// @sections a-x a-y\n//           a-z, a-w\n// @tier page\n//\n//   prose after the tags, indented\nasync (page) => {}",
    );
    expect(tags).toMatchObject({ covers: ["a"], sections: ["a-x", "a-y", "a-z", "a-w"], tier: "page", problems: [] });
  });

  it("ORs values within a criterion and ANDs criteria; a sweep over every group is reached by its tier only", () => {
    expect(names(selectScripts(fixture, { names: ["alpha", "beta"] }))).toEqual(["alpha-widget", "beta-thing"]);
    expect(names(selectScripts(fixture, { groups: ["alpha"] }))).toEqual(["alpha-widget"]);
    expect(names(selectScripts(fixture, { groups: ["alpha", "beta"], tiers: ["component"] }))).toEqual(["alpha-widget", "beta-thing"]);
    expect(names(selectScripts(fixture, { names: ["beta"], groups: ["alpha"] }))).toEqual([]);
    expect(names(selectScripts(fixture, { tiers: ["sweep"] }))).toEqual(["sweep-all"]);
  });

  it("maps a change to the scripts covering its group and every group that depends on it, plus the sweep tier", () => {
    // beta imports alpha, so an alpha change reaches beta's checks too.
    const graph = { edges: new Map([["beta", new Map([["alpha", "x"]])]]) };
    const run = (paths) => [...selectForChanges(paths, fixture, graph).picked.keys()].sort();
    expect(run(["src/components/alpha/Widget.tsx"])).toEqual(["alpha-widget", "beta-thing", "sweep-all"]);
    expect(run(["src/components/beta/Thing.tsx"])).toEqual(["beta-thing", "sweep-all"]);
    expect(run(["showcase/sections/alpha/Widget.tsx"])).toEqual(["alpha-widget", "sweep-all"]);
    expect(run(["scripts/browser/beta-thing.js"])).toEqual(["beta-thing", "sweep-all"]);
    expect(run(["src/tokens.css"])).toEqual(["alpha-widget", "beta-thing", "sweep-all"]);
    expect(run(["../r-ui-css/src/theme.css"])).toEqual(["alpha-widget", "beta-thing", "sweep-all"]);
    // Nothing a browser sees: docs, unit tests, the other gates, a neighbour's docs.
    expect(run(["README.md", "src/components/alpha/Widget.test.tsx", "scripts/verify-class-prefix.mjs", "../mockup/x.html"])).toEqual([]);
    const harness = selectForChanges(["scripts/lib/browser-prelude.js"], fixture, graph);
    expect([...harness.picked.keys()]).toEqual(["sweep-all"]);
    expect(harness.notes).toEqual([expect.stringMatching(/the harness changed \(scripts\/lib\/browser-prelude\.js\): run one script alone/)]);
  });

  it("names every section exactly as the showcase does", () => {
    const paths = globSync("./sections/*/*.tsx", { cwd: join(PKG, "showcase"), dotRelative: true });
    expect(paths.length).toBeGreaterThan(100);
    expect(paths.map(sectionIdOf)).toEqual(paths.map(showcaseSectionIdOf));
    expect([...sectionIds(PKG)].sort()).toEqual(paths.map(showcaseSectionIdOf).sort());
  });

  it("lists a selection without opening a browser, and refuses an unknown option", () => {
    const listed = node("scripts/browser-check.mjs", "--list", "--group", "boards", "--tier=component");
    expect(listed.status).toBe(0);
    expect(listed.stdout.trim().split("\n").map((l) => l.trim().split(" ")[0])).toEqual(["boards-kanban"]);
    const refused = node("scripts/browser-check.mjs", "--list", "--grup", "boards");
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/unknown option --grup/);
  });
});
