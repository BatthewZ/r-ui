// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL = readFileSync(join(HERE, "..", "src", "tokens.css"), "utf8");
const dir = mkdtempSync(join(tmpdir(), "domain-contrast-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Run the gate against a tampered copy of the real tokens. */
function runWith(tamper) {
  const css = tamper(REAL);
  expect(css).not.toBe(REAL);
  const file = join(dir, `tokens-${Math.random().toString(36).slice(2)}.css`);
  writeFileSync(file, css);
  return spawnSync(process.execPath, [join(HERE, "verify-domain-contrast.mjs"), "--tokens", file], { encoding: "utf8" });
}

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:domain-contrast — code roles", { timeout: 30_000 }, () => {
  it("passes the real tokens and measures every code role", () => {
    const result = spawnSync(process.execPath, [join(HERE, "verify-domain-contrast.mjs")], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(\d+ theme\(s\), 9 code role\(s\), 6 density size\(s\)\)/);
  });

  it("goes red when a code pair's dark half sinks into the dark surfaces", () => {
    const result = runWith((css) => css.replace(/(--C-CODE-STRING-DARK: )oklch\([^)]*\)/, "$1oklch(0.350 0.130 145)"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/code role code-string \(--C-CODE-STRING-DARK\) on --C-SURFACE-\d: \d\.\d\d:1 < 4\.5:1/);
    // Only the dark scheme reads the dark half.
    expect(result.stderr).not.toMatch(/--C-CODE-STRING-LIGHT/);
  });

  it("goes red when a light half is too pale for the light surfaces", () => {
    const result = runWith((css) => css.replace(/(--C-CODE-KEYWORD-LIGHT: )oklch\([^)]*\)/, "$1oklch(0.700 0.160 300)"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/code role code-keyword \(--C-CODE-KEYWORD-LIGHT\) on --C-CANVAS/);
  });

  it("holds the rating fill to the mark floor, so a pale light half goes red", () => {
    const result = runWith((css) => css.replace(/(--C-RATING-LIGHT: )oklch\([^)]*\)/, "$1oklch(0.780 0.150 80)"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--C-RATING-LIGHT on --C-CANVAS: \d\.\d\d:1 < 3:1/);
    expect(result.stderr).not.toMatch(/--C-RATING-DARK/);
  });

  it("measures an alias role through the theme, so aliasing a fill goes red", () => {
    const result = runWith((css) => css.replace("--color-code-comment: var(--C-TEXT-MUTED);", "--color-code-comment: var(--C-SURFACE-2);"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/code role code-comment \(--C-SURFACE-2\) on --C-SURFACE-2: 1\.00:1/);
  });

  it("fails rather than passing vacuously when no per-density domain size exists", () => {
    const result = runWith((css) => css.replace(/^\s*--[A-Z-]+-COMFORTABLE:[^\n]*\n/gm, ""));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no per-density domain size \(`--X-COMFORTABLE` on :root\) found/);
  });

  it("fails rather than passing vacuously when no code role exists", () => {
    const result = runWith((css) => css.replace(/^\s*--color-code-[^\n]*\n/gm, ""));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no `--color-code-\*` role found/);
  });
});

/** Run the gate as a consumer would, from this package's root, on its own theme file(s). */
const consumer = (...themes) =>
  spawnSync(process.execPath, [join(HERE, "verify-domain-contrast.mjs"), ...themes.flatMap((t) => ["--theme", t])], {
    cwd: join(HERE, ".."),
    encoding: "utf8",
  });
const fixture = (name) => join("scripts", "fixtures", "domain-contrast", name);

describe("verify:domain-contrast — a consumer's theme", { timeout: 30_000 }, () => {
  it("measures only the given theme, by its path, and passes a legible one", () => {
    const result = consumer(fixture("aurora.css"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(1 theme\(s\), 9 code role\(s\), 6 density size\(s\)\)/);
    expect(result.stdout).toMatch(/\n {2}scripts\/fixtures\/domain-contrast\/aurora\.css :root\[data-theme="aurora"\] \[dark\]/);
  });

  it("goes red on a pair the theme overrides by name, reading surfaces from the file's plain :root too", () => {
    const result = consumer(fixture("midnight.css"));
    expect(result.status).toBe(1);
    const at = 'scripts/fixtures/domain-contrast/midnight.css :root\\[data-theme="midnight"\\]';
    for (const surface of ["CANVAS", "SURFACE-0", "SURFACE-1", "SURFACE-2", "SURFACE-3"]) {
      expect(result.stderr).toMatch(new RegExp(`${at} {2}--C-TREND-GOOD-DARK on --C-${surface}: 1\\.\\d\\d:1 < 4\\.5:1`));
    }
    // Only the overridden pair fails: --C-SURFACE-3 is the file's dark one, not the package's pale default.
    expect(result.stderr).toMatch(/— 5 problem\(s\)/);
  });

  it("goes red on a theme that sets a domain size's selected name, and only that", () => {
    const result = consumer(fixture("solstice.css"));
    expect(result.status).toBe(1);
    const at = 'scripts/fixtures/domain-contrast/solstice.css :root\\[data-theme="solstice"\\]';
    expect(result.stderr).toMatch(new RegExp(`${at} {2}sets --CHART-H, the selected density name: set --CHART-H-COMFORTABLE / --CHART-H-COMPACT instead\\.`));
    expect(result.stderr).toMatch(new RegExp(`${at} {2}sets --SPARK-H, the selected density name`));
    // Its per-density names are the theme's to tune, and its colours are legible.
    expect(result.stderr).toMatch(/— 2 problem\(s\)/);
  });

  it("fails rather than passing vacuously on a file with no theme, or no file", () => {
    const empty = consumer(fixture("no-theme.css"));
    expect(empty.status).toBe(1);
    expect(empty.stderr).toMatch(/no theme found in scripts\/fixtures\/domain-contrast\/no-theme\.css \(a theme block declares --SCHEME-DARK\)/);

    const missing = consumer(fixture("absent.css"));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/--theme scripts\/fixtures\/domain-contrast\/absent\.css: no such file\./);
  });
});
