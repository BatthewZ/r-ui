// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const run = (...args) =>
  spawnSync(process.execPath, [join(HERE, "verify-series-palette.mjs"), ...args], { cwd: PKG, encoding: "utf8" });
const fixture = (name) => join("scripts", "fixtures", "series-palette", name);

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:series-palette", { timeout: 30_000 }, () => {
  it("passes the real palette, measured in both schemes", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\n {2}src\/tokens\.css \[light\] {2}worst ΔE {2}normal \d+\.\d/);
    expect(result.stdout).toMatch(/\n {2}src\/tokens\.css \[dark\] {2}worst ΔE {2}normal \d+\.\d/);
  });

  it("goes red when a theme folds two adjacent series into one colour", () => {
    const result = run("--theme", fixture("aurora.css"));
    expect(result.status).toBe(1);
    const at = String.raw`scripts/fixtures/series-palette/aurora\.css :root\[data-theme="aurora"\] {2}light`;
    expect(result.stderr).toMatch(new RegExp(String.raw`${at} normal: series 1/2 \(adjacent\) ΔE \d+\.\d < 15\.`));
    expect(result.stderr).toMatch(new RegExp(String.raw`${at} deuteranopia: series 1/2 \(adjacent\) ΔE \d+\.\d < 6\.`));
    // The default palette is not what failed.
    expect(result.stderr).not.toMatch(/src\/tokens\.css/);
  });

  it("goes red when two of the first three meet, even when they are not neighbours", () => {
    const result = run("--theme", fixture("dusk.css"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/dusk\.css :root\[data-theme="dusk"\] {2}light normal: series 1\/3 \(first-three\) ΔE \d+\.\d < 15\./);
  });

  it("goes red on the chroma floor and the lightness band, in the theme's own scheme", () => {
    const result = run("--theme", fixture("midnight.css"));
    expect(result.status).toBe(1);
    const at = String.raw`scripts/fixtures/series-palette/midnight\.css :root\[data-theme="midnight"\] {2}`;
    expect(result.stderr).toMatch(new RegExp(String.raw`${at}--C-SERIES-4-DARK: C 0\.050 below the chroma floor 0\.1\.`));
    expect(result.stderr).toMatch(new RegExp(String.raw`${at}--C-SERIES-5-DARK: L 0\.300 outside the dark band \[0\.48, 0\.67\]\.`));
    // A dark theme is measured by its DARK halves only.
    expect(result.stderr).not.toMatch(/midnight[^\n]*-LIGHT/);
  });

  it("fails when a slot is missing, and when a --theme file holds no theme", () => {
    const missing = run("--tokens", fixture("seven-slots.css"));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/seven-slots\.css {2}--C-SERIES-8-LIGHT is not declared on :root\./);
    expect(missing.stderr).toMatch(/seven-slots\.css {2}--C-SERIES-8-DARK is not declared on :root\./);

    const empty = run("--theme", fixture("seven-slots.css"));
    expect(empty.status).toBe(1);
    expect(empty.stderr).toMatch(/no theme found in scripts\/fixtures\/series-palette\/seven-slots\.css/);
  });
});
