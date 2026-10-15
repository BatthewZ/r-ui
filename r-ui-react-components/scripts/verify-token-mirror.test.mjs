// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (fixture) =>
  spawnSync(
    process.execPath,
    [join(HERE, "verify-token-mirror.mjs"), ...(fixture ? ["--root", join(HERE, "fixtures/token-mirror", fixture)] : [])],
    { encoding: "utf8" },
  );

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:token-mirror", { timeout: 30_000 }, () => {
  it("passes a mirror that matches its @theme names, modifiers excluded", () => {
    const result = run("good");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(3 @theme name\(s\) in src\/tokens\.css, .*3 namespace\(s\): color, spacing, text\)/);
  });

  it("goes red on drift in both directions and on a name no namespace takes", () => {
    const result = run("bad");
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/src\/tokens\.css:3 {2}`--color-series-2` is declared in `@theme` but missing from/);
    expect(out).toMatch(/src\/util\/style\.ts {2}`theme\.spacing` mirrors `bar`, which no `@theme` block/);
    expect(out).toMatch(/src\/tokens\.css:5 {2}`--wobble-1` is in a `@theme` block but matches no Tailwind theme/);
    expect(out).toMatch(/— 3 problem\(s\)/);
  });

  it("fails rather than passing vacuously when no @theme name exists", () => {
    const result = run("empty");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/found ZERO `@theme` blocks/);
    expect(result.stderr).toMatch(/found ZERO `@theme` names to check/);
  });

  it("fails on a createCn argument it cannot read as a literal", () => {
    const result = run("computed");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/src\/util\/style\.ts:4 {2}`createCn\(…\)` is not called with an object literal/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
