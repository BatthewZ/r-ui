// Each check passes on the package as shipped and goes red on a tampered copy.
// Fixture themes use an invented name; example theme names are discovered, never written here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { contrast } from "./lib/color.mjs";
import { resolveVars } from "./lib/css.mjs";
import { measureTheme } from "./check-contrast.mjs";
import { forbiddenNames } from "./check-theme-rules.mjs";
import { loadDefaults, readTheme, themeFiles } from "./lib/tokens.mjs";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const tmpDirs = [];
after(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function run(script, args = [], { cwd } = {}) {
  const r = spawnSync(process.execPath, [join(PKG, "scripts", script), ...args], { encoding: "utf8", cwd });
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

  // parseColor reads hex as well as oklch(); the scheme test must judge both.
  test("judges a hex theme's scheme by lightness", () => {
    const scheme = (overrides) =>
      measureTheme({ name: "aurora", tokens: new Map([...loadDefaults(PKG), ...overrides]) }).find((r) => r.kind === "scheme");
    const dark = scheme([["--SCHEME-DARK", "1"], ["--C-CANVAS", "#16181d"], ["--C-TEXT-PRIMARY", "#e8e6e1"]]);
    assert.equal(dark.pass, true, dark.error);
    const inverted = scheme([["--SCHEME-DARK", "0"], ["--C-CANVAS", "#16181d"], ["--C-TEXT-PRIMARY", "#e8e6e1"]]);
    assert.equal(inverted.pass, false);
    assert.match(inverted.error, /--SCHEME-DARK is 0 but text is lighter than the canvas/);
  });

  test("measures the print palette and fails when its text is lowered", () => {
    assert.match(run("check-contrast.mjs").out, /print \(@media print/);
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/print.css"), /--C-TEXT-MUTED: [^;]+;/, "--C-TEXT-MUTED: oklch(0.8 0 0) !important;"));
    const r = run("check-contrast.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /print \(@media print[\s\S]*FAIL TEXT-MUTED on CANVAS/);
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
    for (const n of ["--R-SIZE-3", "--H1", "--H1-line-height", "--BodyText-1", "--ICON", "--CONTROL-H", "--CONTROL-PAD", "--ROW-H", "--HIT-MIN", "--LAYER-STICKY"]) {
      assert.ok(f.has(n), n);
    }
    assert.ok(!f.has("--R-SIZE-3-COMPACT"));
  });

  const cases = [
    ["a theme sets a selected density name", "--SCHEME-DARK: 0; color-scheme: light; --R-SIZE-3: 1rem;", /sets --R-SIZE-3: set --R-SIZE-3-COMFORTABLE/],
    ["a theme sets a derived axis token", "--SCHEME-DARK: 0; color-scheme: light; --CONTROL-H: 3rem;", /sets --CONTROL-H/],
    ["a theme sets the derived control padding", "--SCHEME-DARK: 0; color-scheme: light; --CONTROL-PAD: 1rem;", /sets --CONTROL-PAD: it belongs to an axis/],
    ["a theme sets a layer token", "--SCHEME-DARK: 0; color-scheme: light; --LAYER-STICKY: 50;", /sets --LAYER-STICKY: stacking is structure/],
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

  test("names a caller's theme by the path it was given, and the package's files by the package", () => {
    const pkg = tamperedCopy(() => {});
    const app = mkdtempSync(join(tmpdir(), "r-ui-css-app-"));
    tmpDirs.push(app);
    mkdirSync(join(app, "themes"));
    fixtureTheme(join(app, "themes"), "  color-scheme: light;\n  --SCHEME-DARK: 0;");
    const r = run("check-theme-rules.mjs", ["--pkg", pkg, "themes/aurora.css"], { cwd: app });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^ok {3}themes\/aurora\.css$/m);
    assert.match(r.out, /^ok {3}@batthewz\/r-ui-css\/src\/_theme-template\.css$/m);
    assert.doesNotMatch(r.out, /\.\.\//);
  });

  test("fails when a theme declaration is !important (it would outrank print and the user's preferences)", () => {
    const dir = tamperedCopy(() => {});
    const r = run("check-theme-rules.mjs", ["--pkg", dir, fixtureTheme(dir, "  color-scheme: dark;\n  --SCHEME-DARK: 1;\n  --C-CANVAS: oklch(0.2 0 0) !important;")]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--C-CANVAS is !important/);
  });

  test("fails when print stops mapping a colour role", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/print.css"), /\n {4}--C-SURFACE-2: [^\n]+/, ""));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--C-SURFACE-2 is not set under @media print/);
  });

  test("fails when a print override loses !important or print keeps a dark scheme", () => {
    const dir = tamperedCopy((d) => {
      replaceIn(join(d, "src/tokens/print.css"), "--C-CANVAS: oklch(1 0 0) !important;", "--C-CANVAS: oklch(1 0 0);");
      replaceIn(join(d, "src/tokens/print.css"), "--SCHEME-DARK: 0 !important;", "--SCHEME-DARK: 1 !important;");
    });
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--C-CANVAS under @media print is not !important/);
    assert.match(r.out, /--SCHEME-DARK under @media print is "1", want 0/);
  });

  test("fails when print keeps a shadow", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/print.css"), "--SHADOW-MD: 0 0 transparent !important;", "--SHADOW-MD: 0 1px 2px black !important;"));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--SHADOW-MD under @media print/);
  });

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

  test("fails when a theme loads a font instead of naming one", () => {
    const dir = tamperedCopy(() => {});
    const file = join(dir, "aurora.css");
    writeFileSync(
      file,
      `@import "@fontsource-variable/inter";\n@font-face { font-family: "Aurora Sans"; src: url(aurora.woff2); }\n:root[data-theme="aurora"] { color-scheme: light; --SCHEME-DARK: 0; --FONT-UI: "Aurora Sans", sans-serif; }\n`,
    );
    const r = run("check-theme-rules.mjs", ["--pkg", dir, file]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /@import is not allowed/);
    assert.match(r.out, /@font-face is not allowed/);
  });

  test("fails when a colour role has no forced-colors mapping", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/forced-colors.css"), "    --C-SELECTION: Highlight !important;\n", ""));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--C-SELECTION has no forced-colors mapping/);
  });

  test("fails when a forced-colors mapping is not a system colour", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/forced-colors.css"), "--C-FOCUS: Highlight !important;", "--C-FOCUS: oklch(0.5 0.1 245) !important;"));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--C-FOCUS maps to .*not a system colour/);
  });

  test("fails when an example theme name leaks outside its own file", () => {
    const [first] = themeFiles(PKG);
    assert.ok(first, "the package ships at least one example theme");
    const [name] = readTheme(first).names;
    const dir = tamperedCopy((d) => writeFileSync(join(d, "src/leak.css"), `/* defaults to ${name} */\n`));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /appears in @batthewz\/r-ui-css\/src\/leak\.css/);
  });

  test("fails when a viewport media query redefines a token", () => {
    const dir = tamperedCopy((d) =>
      writeFileSync(join(d, "src/base.css"), `${readFileSync(join(d, "src/base.css"), "utf8")}\n@media (width >= 40rem) { :root { --R-SIZE-1-COMFORTABLE: 3rem; } }\n`),
    );
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /declares a custom property/);
  });

  test("fails when forced colors stop setting the scheme from the forced palette", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/forced-colors.css"), "--SCHEME-DARK: 1 !important;", "--SCHEME-DARK: 0 !important;"));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--SCHEME-DARK must follow the forced palette/);
  });

  test("fails when the template drifts from the defaults", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/_theme-template.css"), /--RADIUS-MD: [^;]+;/, "--RADIUS-MD: 1rem;"));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /template --RADIUS-MD/);
  });

  test("fails when the template omits a themeable token", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/_theme-template.css"), /\n {2}--BORDER-WIDTH: [^\n]+/, ""));
    const r = run("check-theme-rules.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /template is missing --BORDER-WIDTH/);
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

  test("fails when a heading size loses its face", () => {
    const dir = tamperedCopy((d) =>
      replaceIn(join(d, "src/tokens/type.css"), /@utility text-h3 \{[^}]*\}/, ""),
    );
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\.text-h3 does not read --FONT-HEADING in font-family/);
    assert.doesNotMatch(r.out, /\.text-h2 does not read/);
  });

  test("fails when a display size reads the wrong face", () => {
    const dir = tamperedCopy((d) =>
      replaceIn(join(d, "src/tokens/type.css"), /(@utility text-display-2 \{\s*font-family: )[^;]+;/, "$1var(--FONT-HEADING, var(--FONT-UI));"),
    );
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\.text-display-2 does not read --FONT-DISPLAY in font-family/);
  });

  test("fails when a bare border stops reading the line weight", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/shape.css"), "--default-border-width: var(--BORDER-WIDTH);", ""));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\.border does not read --BORDER-WIDTH/);
    assert.match(r.out, /\.divide-y does not read --BORDER-WIDTH/);
  });

  test("fails when a meaning-bearing fill stops opting out of forced colors", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/forced-colors.css"), /@utility bg-selection \{[\s\S]*?\n\}\n/, ""));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\.bg-selection does not opt out under forced colors/);
    assert.match(r.out, /\.aria-selected:bg-selection does not opt out/);
  });

  test("fails when a fill stops remapping status text and its descendants' focus", () => {
    const dir = tamperedCopy((d) =>
      replaceIn(
        join(d, "src/tokens/forced-colors.css"),
        /(@utility bg-accent \{[\s\S]*?)    --C-TEXT-ERROR: HighlightText;[\s\S]*?    & \* \{\n      --C-FOCUS: HighlightText;\n    \}\n/,
        "$1",
      ),
    );
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\.bg-accent does not remap the status text roles/);
    assert.match(r.out, /\.bg-accent does not remap --C-FOCUS for its descendants/);
    assert.doesNotMatch(r.out, /\.bg-selection does not remap/);
  });

  test("fails when a layer mapping is broken", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/layer.css"), "--z-index-sticky:", "--zindex-sticky:"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--zindex-sticky is in no namespace/);
  });

  test("fails when the namespace reset is removed", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/reset.css"), "--color-*: initial;", ""));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /Tailwind default \.bg-blue-500 still generates/);
  });

  test("fails when a container variant drifts from its lever's default", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/type.css"), "--container-column-md: 16rem;", "--container-column-md: 18rem;"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--container-column-md: the container variant compiles to 18rem, but --COLUMN-MD defaults to 16rem/);
  });

  test("fails when a container size reads a custom property (the variant compiles to nothing)", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/type.css"), "--container-column-sm: 11rem;", "--container-column-sm: var(--COLUMN-SM);"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /variant @max-column-sm:flex does not compile to @container \(width < var\(--COLUMN-SM\)\)/);
  });

  test("fails when a container size loses its alias back to the lever", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/tokens/type.css"), "  --container-page: var(--PAGE-MAX);\n", ""));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /--container-page: no :root alias back to its lever/);
  });

  test("fails when a data-print convention or the repeated table head is lost", () => {
    const dir = tamperedCopy((d) => {
      replaceIn(join(d, "src/print.css"), /\[data-print~="hide"\] \{[^}]*\}/, "");
      replaceIn(join(d, "src/print.css"), /thead \{[^}]*\}/, "");
    });
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /print: no `\[data-print~="hide"\]` rule/);
    assert.match(r.out, /print: no `thead` rule/);
    assert.doesNotMatch(r.out, /data-print~="exact"/);
  });

  test("fails when a meaning-bearing fill stops printing its colour", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/print.css"), /@utility bg-status-error \{[\s\S]*?\n\}\n/, ""));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\.bg-status-error does not keep its fill in print/);
    assert.doesNotMatch(r.out, /\.bg-status-info does not keep its fill/);
  });

  test("fails when the print-only convention leaks onto paper or prose stops printing URLs", () => {
    const dir = tamperedCopy((d) => {
      replaceIn(join(d, "src/print.css"), "@media not print {", "@media print {");
      replaceIn(join(d, "src/print.css"), 'content: " (" attr(href) ")";', 'content: "";');
    });
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /data-print~="only"\]` rule .* inside @media not print/);
    assert.match(r.out, /a\[href\^="http"\]/);
  });

  test("fails when prose links stop reading the link levers", () => {
    const dir = tamperedCopy((d) => replaceIn(join(d, "src/prose.css"), "text-underline-offset: var(--LINK-UNDERLINE-OFFSET);", "text-underline-offset: 0.18em;"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /prose: no `a:not\(\[class\]\)` rule matching .*LINK-UNDERLINE-OFFSET/);
    assert.doesNotMatch(r.out, /LINK-DECORATION/);
  });

  test("fails when the CSS does not compile", () => {
    const dir = tamperedCopy((d) => writeFileSync(join(d, "src/base.css"), "@import \"./does-not-exist.css\";\n"));
    const r = run("check-compile.mjs", ["--pkg", dir]);
    assert.equal(r.code, 1, r.out);
  });
});

// Bun's isolated linker (and pnpm) install a package as a symlink. A check run through that
// path must still run, not exit 0 having checked nothing.
describe("run through a symlinked install", () => {
  const app = mkdtempSync(join(tmpdir(), "r-ui-css-symlinked-"));
  tmpDirs.push(app);
  mkdirSync(join(app, "node_modules", "@batthewz"), { recursive: true });
  symlinkSync(PKG, join(app, "node_modules", "@batthewz", "r-ui-css"), "dir");
  // Unreadable text and no color-scheme: both checks must reject it.
  writeFileSync(join(app, "aurora.css"), ':root[data-theme="aurora"] {\n  --SCHEME-DARK: 0;\n  --C-TEXT-PRIMARY: oklch(0.99 0 0);\n}\n');
  const viaLink = (script) => {
    const r = spawnSync(process.execPath, [join("node_modules", "@batthewz", "r-ui-css", "scripts", script), "aurora.css"], { cwd: app, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };

  test("the contrast check runs and fails a bad theme", () => {
    const { code, out } = viaLink("check-contrast.mjs");
    assert.equal(code, 1, out);
    assert.match(out, /aurora/);
  });

  test("the theme-rules check runs and fails a bad theme", () => {
    const { code, out } = viaLink("check-theme-rules.mjs");
    assert.equal(code, 1, out);
    assert.match(out, /aurora/);
  });
});
