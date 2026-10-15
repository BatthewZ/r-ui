// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-no-html-injection.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });

describe("verify:no-html-injection", () => {
  it("goes red on every string-to-markup call, in src and showcase, and only those", () => {
    const result = run(join(HERE, "fixtures/no-html-injection/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/src\/components\/demo\/Bad\.tsx:2 {2}dangerouslySetInnerHTML/);
    expect(out).toMatch(/Bad\.tsx:5 {2}an innerHTML\/outerHTML assignment/);
    expect(out).toMatch(/Bad\.tsx:6 {2}insertAdjacentHTML/);
    expect(out).toMatch(/showcase\/Page\.tsx:2 {2}document\.write/);
    // A comparison is not an assignment.
    expect(out).not.toMatch(/Bad\.tsx:7/);
    expect(out).toMatch(/— 4 string-to-markup call\(s\)/);
  });

  it("passes comments, comparisons and test files", () => {
    const result = run(join(HERE, "fixtures/no-html-injection/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(2 file\(s\)/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
