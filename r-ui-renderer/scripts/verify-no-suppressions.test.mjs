// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-no-suppressions.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });

// Spelled in pieces so this file is not a finding of the gate it tests.
const ESLINT = ["eslint", "disable"].join("-");
const TS_IGNORE = ["@ts", "ignore"].join("-");
const TS_EXPECT = ["@ts", "expect", "error"].join("-");
const TS_NOCHECK = ["@ts", "nocheck"].join("-");

describe("verify:no-suppressions", { timeout: 30_000 }, () => {
  it("goes red on every directive, in sources and configs, at its line", () => {
    const result = run(join(HERE, "fixtures/no-suppressions/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toContain(`src/a.ts:2  ${ESLINT}`);
    expect(out).toContain(`src/a.ts:3  ${TS_IGNORE}`);
    expect(out).toContain(`src/a.ts:4  ${TS_EXPECT}`);
    expect(out).toContain(`src/c.tsx:1  ${TS_NOCHECK}`);
    expect(out).toContain(`vite.config.ts:1  ${ESLINT}`);
    // The gates' own fixtures are skipped.
    expect(out).not.toContain("ignored.ts");
    expect(out).toMatch(/— 5 suppression\(s\)/);
  });

  it("passes a clean tree", () => {
    const result = run(join(HERE, "fixtures/no-suppressions/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(1 file\(s\)\)/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
