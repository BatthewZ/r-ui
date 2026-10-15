// Each check passes on the package as shipped and goes red on a tampered copy.
// Fixture themes use an invented name; example theme names are discovered, never written here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { contrast } from "./lib/color.mjs";
import { resolveVars } from "./lib/css.mjs";
import { forbiddenNames } from "./check-theme-rules.mjs";
import { loadDefaults, readTheme, themeFiles } from "./lib/tokens.mjs";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const tmpDirs = [];
after(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function run(script, args = []) {
  const r = spawnSync(process.execPath, [join(PKG, "scripts", script), ...args], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A throwaway copy of the package (src + package.json) whose node_modules points at ours. */
function tamperedCopy(edit) {
  const dir = mkdtempSync(join(tmpdir(), "r-ui-css-fixture-"));
  tmpDirs.push(dir);
  cpSync(join(PKG, "src"), join(dir, "src"), { recursive: true });
  cpSync(join(PKG, "package.json"), join(dir, "package.json"));
  if (existsSync(join(PKG, "node_modules"))) symlinkSync(join(PKG, "node_modules"), join(dir, "node_modules"), "dir");
  edit(dir);
  return dir;
}

function replaceIn(file, from, to) {
  const before = readFileSync(file, "utf8");
  const afterText = before.replace(from, to);
  assert.notEqual(afterText, before, `fixture edit did not apply to ${file}`);
  writeFileSync(file, afterText);
}

function fixtureTheme(dir, body) {
  const file = join(dir, "aurora.css");
  writeFileSync(file, `:root[data-theme="aurora"] {\n${body}\n}\n`);
  return file;
}

describe("colour maths", () => {
  test("reproduces known WCAG ratios", () => {
    assert.equal(contrast("oklch(1 0 0)", "oklch(0 0 0)").ratio.toFixed(2), "21.00");
    assert.equal(contrast("#767676", "#ffffff").ratio.toFixed(2), "4.54");
    assert.equal(contrast("#0000ff", "#ffffff").ratio.toFixed(2), "8.59");
    assert.ok(Math.abs(contrast("oklch(0.452 0.313 264.05)", "oklch(1 0 0)").ratio - 8.59) < 0.02);
  });

  test("composites translucent colours over their backdrop", () => {
    const half = contrast("oklch(0 0 0 / 0.5)", "oklch(1 0 0)").ratio;
    assert.ok(half > 3 && half < 5, `got ${half}`);
  });

  test("resolves var() chains and fallbacks", () => {
    const map = new Map([["--A", "var(--B)"], ["--B", "oklch(0.5 0 0)"]]);
    assert.equal(resolveVars("var(--A)", map), "oklch(0.5 0 0)");
    assert.equal(resolveVars("var(--MISSING, var(--B))", map), "oklch(0.5 0 0)");
    assert.throws(() => resolveVars("var(--MISSING)", map), /not declared/);
  });
});

describe("contrast check", () => {
  test("passes on the package", () => {
    const r = run("check-contrast.mjs");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /pairs pass across \d+ theme/);
  });

  test("fails when a default text token is lowered", () => {
    const dir = tamperedCopy((d) =>
      replaceIn(join(d, "src/tokens/color.css"), /--C-TEXT-MUTED: [^;]+;/, "--C-TEXT-MUTED: oklch(0.8 0.008 85);"),
    );
    const r = run("check-contrast.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL TEXT-MUTED on SURFACE-0/);
  });

  test("fails when a theme's text token is lowered", () => {
    const dir = tamperedCopy(() => {});
    const theme = fixtureTheme(dir, "  color-scheme: light;\n  --SCHEME-DARK: 0;\n  --C-TEXT-SECONDARY: oklch(0.85 0 0);");
    const r = run("check-contrast.mjs", ["--pkg", dir, theme]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /aurora[\s\S]*FAIL TEXT-SECONDARY/);
  });

  test("fails on a dark theme that keeps light-theme colours", () => {
    const dir = tamperedCopy(() => {});
    const theme = fixtureTheme(dir, "  color-scheme: dark;\n  --SCHEME-DARK: 1;");
    const r = run("check-contrast.mjs", ["--pkg", dir, theme]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /partial theme/);
  });

  test("fails when a theme references a token that does not exist", () => {
    const dir = tamperedCopy(() => {});
    const theme = fixtureTheme(dir, "  color-scheme: light;\n  --SCHEME-DARK: 0;\n  --C-TEXT-PRIMARY: var(--C-NOPE);");
    assert.equal(run("check-contrast.mjs", ["--pkg", dir, theme]).code, 1);
  });
});

describe("theme rules check", () => {
  test("passes on the package", () => {
    const r = run("check-theme-rules.mjs");
    assert.equal(r.code, 0, r.out);
  });

  test("forbidden names cover every selected density name and the axis tokens", () => {
    const f = forbiddenNames(loadDefaults(PKG));
    for (const n of ["--R-SIZE-3", "--H1", "--H1-line-height", "--BodyText-1", "--ICON", "--CONTROL-H", "--ROW-H", "--HIT-MIN"]) {
      assert.ok(f.has(n), n);
    }
    assert.ok(!f.has("--R-SIZE-3-COMPACT"));
  });

  const cases = [
    ["a theme sets a selected density name", "--SCHEME-DARK: 0; color-scheme: light; --R-SIZE-3: 1rem;", /sets --R-SIZE-3: set --R-SIZE-3-COMFORTABLE/],
    ["a theme sets a derived axis token", "--SCHEME-DARK: 0; color-scheme: light; --CONTROL-H: 3rem;", /sets --CONTROL-H/],
    ["a theme omits --SCHEME-DARK", "color-scheme: light;", /missing --SCHEME-DARK/],
    ["a theme omits color-scheme", "--SCHEME-DARK: 0;", /missing color-scheme/],
    ["--SCHEME-DARK disagrees with color-scheme", "color-scheme: dark; --SCHEME-DARK: 0;", /--SCHEME-DARK is 0 but color-scheme is dark/],
  ];
  for (const [label, body, expected] of cases) {
    test(`fails when ${label}`, () => {
      const dir = tamperedCopy(() => {});
      const r = run("check-theme-rules.mjs", ["--pkg", dir, fixtureTheme(dir, body)]);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, expected);
    });
  }

  test("fails on a subtree selector or an @media block in a theme", () => {
    const dir = tamperedCopy(() => {});
    const file = join(dir, "aurora.css");
    writeFileSync(
      file,
      `:root[data-theme="aurora"] { color-scheme: light; --SCHEME-DARK: 0; }\n.card[data-theme="aurora"] { --C-CANVAS: oklch(1 0 0); }\n@media (width >= 40rem) { :root[data-theme="aurora"] { --C-CANVAS: oklch(1 0 0); } }\n`,
    );
    const r = run("check-theme-rules.mjs", ["--pkg", dir, file]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /is not :root\[data-theme/);
    assert.match(r.out, /@media is not allowed/);
  });

  test("fails when an example theme name leaks outside its own file", () => {
    const [first] = themeFiles(PKG);
    assert.ok(first, "the package ships at least one example theme");
    const [name] = readTheme(first).names;
    const dir = tamperedCopy((d) => writeFileSync(join(d, "src/leak.css"), `/* defaults to ${name} */\n`));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /appears in src\/leak\.css/);
  });

  test("fails when a viewport media query redefines a token", () => {
    const dir = tamperedCopy((d) =>
      writeFileSync(join(d, "src/base.css"), `${readFileSync(join(d, "src/base.css"), "utf8")}\n@media (width >= 40rem) { :root { --R-SIZE-1-COMFORTABLE: 3rem; } }\n`),
    );
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /declares a custom property/);
  });

  test("fails when the template drifts from the defaults", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/_theme-template.css"), /--RADIUS-MD: [^;]+;/, "--RADIUS-MD: 1rem;"));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /template --RADIUS-MD/);
  });
});

describe("compile check", () => {
  test("passes on the package", () => {
    const r = run("check-compile.mjs");
    assert.equal(r.code, 0, r.out);
  });

  test("fails when a theme mapping is broken", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/density.css"), "--spacing-control: var(--CONTROL-H);", "--spacing-controls: var(--CONTROL-H);"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /missing utility \.h-control/);
  });

  test("fails when the namespace reset is removed", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/reset.css"), "--color-*: initial;", ""));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /Tailwind default \.bg-blue-500 still generates/);
  });

  test("fails when the CSS does not compile", () => {
    const dir = tamperedCopy((d) => writeFileSync(join(d, "src/base.css"), "@import \"./does-not-exist.css\";\n"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
  });
});
