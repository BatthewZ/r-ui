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

describe("verify:domain-contrast — code roles", () => {
  it("passes the real tokens and measures every code role", () => {
    const result = spawnSync(process.execPath, [join(HERE, "verify-domain-contrast.mjs")], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(\d+ theme\(s\), 9 code role\(s\)\)/);
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

  it("measures an alias role through the theme, so aliasing a fill goes red", () => {
    const result = runWith((css) => css.replace("--color-code-comment: var(--C-TEXT-MUTED);", "--color-code-comment: var(--C-SURFACE-2);"));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/code role code-comment \(--C-SURFACE-2\) on --C-SURFACE-2: 1\.00:1/);
  });

  it("fails rather than passing vacuously when no code role exists", () => {
    const result = runWith((css) => css.replace(/^\s*--color-code-[^\n]*\n/gm, ""));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no `--color-code-\*` role found/);
  });
});
