import { describe, expect, it } from "vitest";

import { patternProblem } from "./patterns";

describe("patternProblem", () => {
  it.each([
    ["^(a+)+$", /repeat inside a repeat/],
    ["^(\\w+\\s?)*$", /repeat inside a repeat/],
    ["(a*)*b", /repeat inside a repeat/],
    ["^(?:[a-z]+\\d*)+$", /repeat inside a repeat/],
    ["^(a|ab)+$", /Alternatives/],
    ["^(\\w|\\d)+$", /Alternatives/],
    ["^(a)\\1$", /backreference/],
    ["^(?<x>a)\\k<x>$", /backreference/],
    ["\\d+\\d+x", /side by side/],
    ["^.*\\s*.*$", /side by side/],
    ["(?=(a+)+)", /repeat inside a repeat/],
    ["^(a+", /compile/],
  ])("refuses %s, saying why", (source, why) => {
    expect(patternProblem(source)).toMatch(why);
  });

  it.each([
    "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    "^\\d{3}-\\d{4}$",
    "^\\+?[0-9 ()-]{7,20}$",
    "^-?\\d+(?:\\.\\d+)?$",
    "^-?\\d{1,3}(?:,\\d{3})*$",
    "^([A-Z][a-z]*\\s?)+$",
    "^[A-Z]{2}\\d{2}[A-Z0-9]{1,30}$",
    "^(?:[a-z]|-)+$",
    "a{2,}",
    "\\{x}",
    "^\\x41\\u0042[\\]]$",
  ])("lets the everyday pattern %s through", (source) => {
    expect(patternProblem(source)).toBeUndefined();
  });

  it("keeps the refused pattern from hanging: the exploit's shape is caught before it runs", () => {
    expect(patternProblem("^(a+)+$")).toBeDefined();
    expect(patternProblem("^(a+)+$")).toBe(patternProblem("^(a+)+$"));
  });
});
