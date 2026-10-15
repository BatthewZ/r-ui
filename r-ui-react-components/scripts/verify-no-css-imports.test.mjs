// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-no-css-imports.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:no-css-imports", { timeout: 30_000 }, () => {
  it("goes red on a side-effect, a default and a dynamic CSS import, each at its own line", () => {
    const result = run(join(HERE, "fixtures/no-css-imports/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/\n {2}src\/components\/demo\/Bad\.tsx:1 {2}import "\.\/styles\.css"\n/);
    expect(out).toMatch(/\n {2}src\/components\/demo\/Bad\.tsx:3 {2}import sheet from "\.\/theme\.css\?inline"\n/);
    expect(out).toMatch(/\n {2}src\/components\/demo\/Bad\.tsx:4 {2}import\("\.\/late\.css"\)\n/);
    expect(out).toMatch(/— 3 CSS import\(s\) from JS/);
  });

  it("passes a comment and a string that name a stylesheet, and ignores the showcase", () => {
    const result = run(join(HERE, "fixtures/no-css-imports/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(1 \.ts\/\.tsx files, 0 CSS imports\)/);
  });

  it("fails rather than passing vacuously when there is nothing to scan", () => {
    const result = run(join(HERE, "fixtures/no-css-imports/good/showcase"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no \.ts\/\.tsx files under .*; the scan is broken/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
