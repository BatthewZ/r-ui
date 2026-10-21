// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { adviseTheme, isThemeColour, THEME_CONTRAST_PAIRS, THEME_TOKENS, themeProblem, themeRequest } from "./theme";
import type { ThemeSpec } from "./types";
import { validateViewSpec } from "./validate";
import { VIEWSPEC_SCHEMA } from "./validate-schema";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, "..", "..", "node_modules", "@batthewz", "r-ui-css", "src", "_theme-template.css"), "utf8");

const doc = (theme: unknown) => ({ version: 2, title: "Themed", theme, root: "x" });
const codes = (theme: unknown, policy = {}) => validateViewSpec(doc(theme), { policy }).issues.map((issue) => [issue.code, issue.path]);

/** A palette that meets every floor: light text on dark surfaces, every role set. */
const MIDNIGHT: ThemeSpec = {
  scheme: "dark",
  tokens: {
    "--C-CANVAS": "oklch(0.2 0.012 250)",
    "--C-SURFACE-0": "oklch(0.27 0.014 250)",
    "--C-SURFACE-1": "oklch(0.24 0.013 250)",
    "--C-SURFACE-2": "oklch(0.17 0.011 250)",
    "--C-SURFACE-3": "oklch(0.14 0.01 250)",
    "--C-TEXT-PRIMARY": "oklch(0.95 0.006 250)",
    "--C-TEXT-SECONDARY": "oklch(0.82 0.01 250)",
    "--C-TEXT-MUTED": "oklch(0.74 0.012 250)",
  },
};

describe("the roles a theme may set", () => {
  it("are exactly the theme template's --C-* roles, translucent where the template writes alpha", () => {
    const declared = [...TEMPLATE.matchAll(/^\s*(--C-[A-Z0-9-]+)\s*:\s*([^;]+);/gm)].map((match) => [match[1], /\//.test(match[2] as string)]);
    expect(THEME_TOKENS.map((token) => [token.name, token.translucent])).toEqual(declared);
    const schemaKeys = Object.keys(VIEWSPEC_SCHEMA.$defs.Theme?.properties?.tokens?.properties ?? {});
    expect(schemaKeys).toEqual(THEME_TOKENS.map((token) => token.name));
  });

  it("refuse every other name: the scheme switch, sizes, motion, a domain colour, a misspelling", () => {
    for (const name of ["--SCHEME-DARK", "--R-SIZE-3", "--R-SIZE-3-COMPACT", "--DURATION-FAST", "--RADIUS-MD", "--C-SERIES-1-LIGHT", "--c-canvas", "--C-CANVS", "background"]) {
      expect(codes({ tokens: { [name]: "#000000" } }), name).toEqual([["unknown-key", `/theme/tokens/${name}`]]);
    }
    for (const { name } of THEME_TOKENS) expect(codes({ tokens: { [name]: "#808080" } }), name).not.toContainEqual(["unknown-key", `/theme/tokens/${name}`]);
  });

  it("are never translucent where a contrast pair measures them", () => {
    const measured = new Set(THEME_CONTRAST_PAIRS.flatMap((pair) => [pair.fg, pair.bg]));
    const translucent = THEME_TOKENS.filter((token) => token.translucent).map((token) => token.name);
    expect(translucent.length).toBeGreaterThan(0);
    for (const name of translucent) expect(measured.has(name), name).toBe(false);
  });
});

describe("the colour grammar", () => {
  const ACCEPT = [
    "#0a0b0c",
    "#abc",
    "#ABC",
    "#AbCdEf",
    "rgb(10 20 30)",
    "rgb( 10   20 30 )",
    "rgb(10% 20% 30%)",
    "hsl(210 40% 20%)",
    "hsl(210deg 40% 20%)",
    "hsl(0.5turn 40% 20%)",
    "oklch(0.62 0.13 250)",
    "oklch(62% 0.13 250deg)",
    "oklch(.5 .1 1e2)",
    "oklch(0.5 0 none)",
    "oklab(0.5 -0.1 0.1)",
    "lab(50 20 -30)",
    "lch(50 40 200)",
  ];
  const REFUSE = [
    "var(--C-CANVAS)",
    "oklch(var(--l) 0.1 250)",
    "url(x.png)",
    "url(#a)",
    "calc(1px)",
    "color-mix(in oklch, #000, #fff)",
    "light-dark(#000, #fff)",
    "red",
    "transparent",
    "currentColor",
    "inherit",
    "rgb(1, 2, 3)",
    "rgba(1 2 3)",
    "RGB(1 2 3)",
    "Oklch(0.5 0.1 250)",
    "rgb(1 2)",
    "oklch(0.5 0.1 250px)",
    "hsl(210 40 20)",
    "#abcd",
    "#12345678",
    "#12",
    "#ggg",
    "oklch(0.5 0.1 250 / 0.5)",
    "rgb(1 2 3) ",
    "rgb(1 2 3);background:red",
    "rgb(1 2 3)}*{color:red",
    // Space to JavaScript, not to CSS: the browser would drop the role.
    "rgb(1\u00a02 3)",
    "rgb(1\u20282 3)",
    "oklch(0.5\ufeff0.1 250)",
    "",
    "junk",
  ];

  it("accepts hex and six functions with numbers, on every role", () => {
    for (const value of ACCEPT) {
      expect(isThemeColour("--C-CANVAS", value), value).toBe(true);
      expect(isThemeColour("--C-SCRIM", value), value).toBe(true);
      expect(codes({ tokens: { "--C-CANVAS": value } }), value).toEqual([]);
    }
  });

  it("refuses var(), url(), calc(), colour mixes, keywords, commas, upper-case names and junk, as an error at the role", () => {
    for (const value of REFUSE) {
      expect(isThemeColour("--C-CANVAS", value), value).toBe(false);
      expect(codes({ tokens: { "--C-CANVAS": value } }), value).toEqual([["invalid-value", "/theme/tokens/--C-CANVAS"]]);
    }
  });

  it("takes alpha only on a translucent role", () => {
    for (const value of ["#0006", "#00000066", "oklch(0.2 0.006 85 / 0.4)", "rgb(0 0 0 / 40%)", "hsl(0 0% 0% / none)"]) {
      expect(codes({ tokens: { "--C-SCRIM": value, "--C-BORDER": value } }), value).toEqual([]);
      expect(codes({ tokens: { "--C-SURFACE-0": value } }), value).toEqual([["invalid-value", "/theme/tokens/--C-SURFACE-0"]]);
    }
  });
});

describe("the theme's shape", () => {
  it("is an object of an optional scheme and optional roles", () => {
    expect(codes({})).toEqual([]);
    expect(codes({ scheme: "light" })).toEqual([]);
    expect(codes("aurora")).toEqual([["invalid-type", "/theme"]]);
    expect(codes({ name: "aurora" })).toEqual([["unknown-key", "/theme/name"]]);
    expect(codes({ scheme: "dim" })).toEqual([["invalid-value", "/theme/scheme"]]);
    expect(codes({ tokens: ["#000"] })).toEqual([["invalid-type", "/theme/tokens"]]);
    expect(codes({ tokens: { "--C-CANVAS": 0 } })).toEqual([["invalid-type", "/theme/tokens/--C-CANVAS"]]);
  });

  it("is judged the same way where the renderer refuses it (themeProblem) and the schema rejects it", () => {
    const cases: unknown[] = ["aurora", { name: "aurora" }, { scheme: "dim" }, { tokens: [] }, { tokens: { "--C-CANVAS": 0 } }, { tokens: { "--C-CANVS": "#000" } }, { tokens: { "--C-CANVAS": "red" } }, {}, MIDNIGHT];
    for (const theme of cases) {
      const problem = themeProblem(theme);
      const errors = validateViewSpec(doc(theme)).issues.filter((issue) => issue.severity === "error");
      expect(problem === undefined, JSON.stringify(theme)).toBe(errors.length === 0);
      if (problem !== undefined) expect([problem.code, problem.path]).toEqual([errors[0]?.code, errors[0]?.path]);
    }
  });

  it("is written after density and before state, data, forms and root", () => {
    const late = { version: 2, title: "t", state: {}, theme: {}, root: "x" };
    expect(validateViewSpec(late).issues.map((issue) => issue.code)).toEqual(["key-order"]);
    expect(validateViewSpec({ version: 2, title: "t", density: "compact", theme: {}, state: {}, root: "x" }).issues).toEqual([]);
  });
});

describe("the host's policy", () => {
  it("lets a theme through by default, ignores it when off, and narrows it to a list of roles", () => {
    expect(themeRequest(MIDNIGHT, {}).tokens.size).toBe(8);
    expect(codes(MIDNIGHT, { themeOverrides: false })).toEqual([["theme-disabled", "/theme"]]);
    expect(themeRequest(MIDNIGHT, { themeOverrides: false }).tokens.size).toBe(0);
    const narrow = themeRequest(MIDNIGHT, { themeOverrides: ["--C-CANVAS", "--C-TEXT-PRIMARY", "--not-a-role"] });
    expect([...narrow.tokens.keys()]).toEqual(["--C-CANVAS", "--C-TEXT-PRIMARY"]);
    expect(narrow.scheme).toBe("dark");
    expect(narrow.issues.map((issue) => [issue.code, issue.path])).toEqual(
      ["--C-SURFACE-0", "--C-SURFACE-1", "--C-SURFACE-2", "--C-SURFACE-3", "--C-TEXT-SECONDARY", "--C-TEXT-MUTED"].map((name) => ["theme-disabled", `/theme/tokens/${name}`]),
    );
  });
});

describe("contrast advice", () => {
  it("passes a palette that meets every floor among the roles it sets", () => {
    expect(adviseTheme(MIDNIGHT, {})).toEqual([]);
  });

  it("warns on each floor both of whose roles the document sets, at the foreground, naming both roles and the ratio", () => {
    const theme = { tokens: { ...MIDNIGHT.tokens, "--C-TEXT-MUTED": "oklch(0.35 0.01 250)" } };
    const issues = adviseTheme(theme, {});
    expect(issues.map((issue) => [issue.code, issue.severity, issue.path])).toEqual([["theme-contrast", "warning", "/theme/tokens/--C-TEXT-MUTED"]]);
    expect(issues[0]?.message).toMatch(/`--C-TEXT-MUTED` on `--C-CANVAS` is \d\.\d\d:1 \(the floor is 4\.5:1\)/);
    expect(issues[0]?.message).toContain("`--C-TEXT-MUTED` on `--C-SURFACE-3`");
    // Through the validator, as a warning: the document still conforms.
    const result = validateViewSpec(doc(theme));
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual(["theme-contrast"]);
  });

  it("fails a floor it cannot finish measuring, as unmeasured: an infinite channel passes nothing", () => {
    const issues = adviseTheme({ tokens: { "--C-CANVAS": "#ffffff", "--C-TEXT-PRIMARY": "oklch(0.97 0.1 1e400)" } }, {});
    expect(issues.map((issue) => [issue.code, issue.path])).toEqual([["theme-contrast", "/theme/tokens/--C-TEXT-PRIMARY"]]);
    expect(issues[0]?.message).toContain("`--C-TEXT-PRIMARY` on `--C-CANVAS` could not be measured");
  });

  it("leaves alone a floor with one side unset: the host's palette is unknown to the validator", () => {
    expect(adviseTheme({ tokens: { "--C-TEXT-PRIMARY": "#fafafa" } }, {})).toEqual([]);
  });

  it("checks the scheme against the text and canvas the document sets", () => {
    const issues = adviseTheme({ ...MIDNIGHT, scheme: "light" }, {});
    expect(issues.map((issue) => issue.path)).toEqual(["/theme/scheme"]);
    expect(issues[0]?.message).toContain('`--C-TEXT-PRIMARY` must be darker than `--C-CANVAS` under `scheme: "light"`');
  });

  it("judges what the host lets through, and nothing when the host ignores themes", () => {
    const theme = { tokens: { ...MIDNIGHT.tokens, "--C-TEXT-MUTED": "oklch(0.35 0.01 250)" } };
    expect(adviseTheme(theme, { themeOverrides: ["--C-CANVAS"] }).map((issue) => issue.code)).not.toContain("theme-contrast");
    expect(adviseTheme(theme, { themeOverrides: false }).map((issue) => issue.code)).toEqual(["theme-disabled"]);
  });
});
