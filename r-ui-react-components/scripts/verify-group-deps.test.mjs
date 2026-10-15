// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-group-deps.mjs"), "--root", root], { encoding: "utf8" });

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:group-deps", { timeout: 30_000 }, () => {
  it("goes red on a cycle between groups, through a deep import and a type re-export, and between a group and util", () => {
    const result = run(join(HERE, "fixtures/group-deps/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/— 2 import cycle\(s\) between groups/);
    expect(out).toMatch(/menu ⇄ picker/);
    expect(out).toMatch(/menu → picker {2}\(src\/components\/menu\/Menu\.tsx:4\)/);
    expect(out).toMatch(/picker → menu {2}\(src\/components\/picker\/Picker\.tsx:1\)/);
    expect(out).toMatch(/base ⇄ util/);
    expect(out).toMatch(/util → base {2}\(src\/util\/style\.ts:1\)/);
  });

  it("goes red on a group importing the package's root barrel, which re-exports that group", () => {
    const result = run(join(HERE, "fixtures/group-deps/barrel"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/— 1 import cycle\(s\) between groups/);
    expect(out).toMatch(/a ⇄ b ⇄ index/);
    expect(out).toMatch(/a → index {2}\(src\/components\/a\/A\.tsx:1\)/);
    expect(out).toMatch(/index → a {2}\(src\/index\.ts:1\)/);
  });

  it("passes one-way imports; a test file and a comment add no edge", () => {
    const result = run(join(HERE, "fixtures/group-deps/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(4 groups, 3 cross-group edge\(s\), no cycle\)/);
  });
});
