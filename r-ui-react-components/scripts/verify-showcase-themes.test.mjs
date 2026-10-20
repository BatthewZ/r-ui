// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const run = (...args) =>
  spawnSync(process.execPath, [join(HERE, "verify-showcase-themes.mjs"), ...args], { cwd: PKG, encoding: "utf8" });
const fixture = (name) => join("scripts", "fixtures", "showcase-themes", name);

// Each case runs four gates as subprocesses.
describe("verify:showcase-themes", { timeout: 60_000 }, () => {
  it("passes the showcase's own themes, every gate run", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /^verify:showcase-themes — OK \([1-9]\d* theme file\(s\) in showcase\/themes: contrast, theme rules, domain contrast, series palette\)/,
    );
  });

  it("goes red through the CSS package's contrast check", () => {
    const result = run("--dir", fixture("contrast"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/\[contrast\]\n[\s\S]*FAIL TEXT-MUTED on CANVAS: \d+\.\d+ < 4\.5/);
  });

  it("goes red through the CSS package's theme rules, and only there", () => {
    const result = run("--dir", fixture("rules"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/1 gate\(s\) failed/);
    expect(result.stderr).toMatch(/\[theme rules\]\n[\s\S]*\nFAIL scripts\/fixtures\/showcase-themes\/rules\/dawn\.css\n\s+sets --R-SIZE-3:/);
  });

  it("goes red through this package's domain contrast, and only there", () => {
    const result = run("--dir", fixture("domain"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/1 gate\(s\) failed/);
    expect(result.stderr).toMatch(
      /\[domain contrast\]\n[\s\S]*ember\.css :root\[data-theme="ember"\] {2}--C-TEXT-STALE-LIGHT on --C-CANVAS: \d+\.\d+:1 < 4\.5:1/,
    );
  });

  it("goes red through this package's series palette, and only there", () => {
    const result = run("--dir", fixture("series"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/1 gate\(s\) failed/);
    expect(result.stderr).toMatch(/\[series palette\]\n[\s\S]*frost\.css :root\[data-theme="frost"\] {2}light normal: series 1\/2 \(adjacent\) ΔE 0\.0 < 15\./);
  });

  it("fails a directory with no theme file instead of passing vacuously", () => {
    const result = run("--dir", fixture("empty"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no theme file in scripts\/fixtures\/showcase-themes\/empty; the gate measured nothing\./);
  });
});
