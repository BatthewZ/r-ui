// @vitest-environment node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { classProblems, cssProblems, themeNameProblems } from "./verify-tokens.mjs";

const TOKENS = new Set(["--R-SIZE-3", "--C-BORDER", "--CONTROL-H", "--CONTROL-H-COMPACT"]);
const problemsOf = (found) => found.map((f) => f.problem);

describe("cssProblems", () => {
  it("passes token reads, proportions and the viewport", () => {
    const css = `@layer components {
      .pg-a { padding: var(--R-SIZE-3); inline-size: 100%; block-size: 100dvh; margin: 0; grid-template-columns: minmax(0, 2fr); }
      @media (width >= --theme(--breakpoint-lg)) { .pg-a > code { border: var(--BORDER-W, 0) solid var(--C-BORDER); } }
    }`;
    expect(problemsOf(cssProblems(css, new Set([...TOKENS, "--BORDER-W"])))).toEqual([]);
  });

  it("refuses a raw length, in a rule and in a media query", () => {
    expect(problemsOf(cssProblems(".pg-a { gap: 12px; }", TOKENS))).toEqual([".pg-a { gap: 12px }: the raw length 12px; use a token"]);
    expect(problemsOf(cssProblems("@media (width >= 64rem) { .pg-a { gap: 0; } }", TOKENS))).toEqual([
      "@media (width >= 64rem): the raw length 64rem; use a token",
    ]);
  });

  it("refuses a raw colour", () => {
    expect(problemsOf(cssProblems(".pg-a { color: #fff; }", TOKENS))).toEqual([".pg-a { color: #fff }: a raw colour; use a token"]);
    expect(problemsOf(cssProblems(".pg-a { color: oklch(0.5 0.1 200); }", TOKENS))).toEqual([
      ".pg-a { color: oklch(0.5 0.1 200) }: a raw colour; use a token",
    ]);
  });

  it("refuses an undeclared token and a density's named value", () => {
    expect(problemsOf(cssProblems(".pg-a { gap: var(--R-SIZE-9); }", TOKENS))).toEqual([
      ".pg-a { gap: var(--R-SIZE-9) }: reads --R-SIZE-9, which no token declares",
    ]);
    expect(problemsOf(cssProblems(".pg-a { block-size: var(--CONTROL-H-COMPACT); }", TOKENS))).toEqual([
      ".pg-a { block-size: var(--CONTROL-H-COMPACT) }: reads --CONTROL-H-COMPACT, a density's named value; read the selected token",
    ]);
  });

  it("refuses a class without the pg- prefix", () => {
    expect(problemsOf(cssProblems(".panel { gap: 0; }", TOKENS))).toEqual([".panel: the class `panel` lacks the pg- prefix"]);
  });

  it("ignores comments and the @import and @source lines", () => {
    const css = '@import "./x.css";\n@source "./**/*.{ts,tsx}";\n/* .bad { gap: 4px; } */\n.pg-a { gap: 0; }';
    expect(problemsOf(cssProblems(css, TOKENS))).toEqual([]);
  });
});

describe("classProblems", () => {
  const vocabulary = new Set(["gap-r3", "w-full"]);

  it("passes pg- classes and vocabulary utilities in every literal form", () => {
    const source = 'a = <div className="pg-a gap-r3" />; b = <div className={"w-full"} />; c = <div className={`pg-b ${x}`} />;';
    expect(problemsOf(classProblems(source, vocabulary))).toEqual([]);
  });

  it("refuses a Tailwind default and an unknown class", () => {
    expect(problemsOf(classProblems('<div className="p-4 gap-r3 fancy" />', vocabulary))).toEqual([
      "the class `p-4` is neither pg- nor a token utility in the vocabulary",
      "the class `fancy` is neither pg- nor a token utility in the vocabulary",
    ]);
  });
});

describe("themeNameProblems", () => {
  it("finds a theme name as a word, in any case, with its line", () => {
    const found = themeNameProblems('const a = 1;\nconst theme = "Aurora";\nconst auroras = 2;', ["aurora"]);
    expect(found).toEqual([{ line: 2, problem: 'names the example theme "Aurora"; only the theme list may' }]);
  });
});

describe("verify-tokens on the playground", () => {
  it("passes", () => {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-tokens.mjs", import.meta.url))], { encoding: "utf8" });
    expect(run.stderr).toBe("");
    expect(run.stdout).toMatch(/^verify:playground — OK/);
    expect(run.status).toBe(0);
  });
});
