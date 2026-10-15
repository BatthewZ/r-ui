// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkHalfReads, checkTokens } from "./lib/domain-pairs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const real = readFileSync(join(HERE, "..", "src", "tokens.css"), "utf8");
const blend = (x) => `color-mix(in oklch, var(--${x}-LIGHT), var(--${x}-DARK) calc(var(--SCHEME-DARK) * 100%))`;

describe("verify:domain-pairs", () => {
  it("passes the real tokens.css", () => {
    const { problems, pairs } = checkTokens(real);
    expect(problems).toEqual([]);
    expect(pairs).toContain("C-SERIES-1");
    expect(pairs).toContain("C-STATUS-STALE");
  });

  it("goes red when a DARK half is deleted", () => {
    const tampered = real.replace(/^\s*--C-SERIES-3-DARK:.*$/m, "");
    const { problems } = checkTokens(tampered);
    expect(problems.some((p) => p.includes("--C-SERIES-3-LIGHT has no --C-SERIES-3-DARK"))).toBe(true);
  });

  it("goes red on a single-value domain colour and on a raw @theme value", () => {
    const css = `:root { --C-FOO: oklch(0.5 0.1 200); }\n@theme inline { --color-foo: oklch(0.5 0.1 200); }`;
    const { problems } = checkTokens(css);
    expect(problems.some((p) => p.includes("--C-FOO: a raw colour outside a LIGHT/DARK pair"))).toBe(true);
    expect(problems.some((p) => p.includes("--color-foo"))).toBe(true);
  });

  it("goes red on an orphan pair and on a blend of a mismatched pair", () => {
    const css =
      `:root { --C-A-LIGHT: oklch(0.5 0.1 1); --C-A-DARK: oklch(0.6 0.1 1); }\n` +
      `@theme inline { --color-b: ${blend("C-B")}; }`;
    const { problems } = checkTokens(css);
    expect(problems.some((p) => p.includes("pair --C-A-LIGHT/-DARK is not exposed"))).toBe(true);
    expect(problems.some((p) => p.includes("--color-b blends --C-B-LIGHT/-DARK, which is not a declared pair"))).toBe(true);
  });

  it("allows an alias of a contract role", () => {
    const { problems } = checkTokens(`@theme inline { --color-trend-flat: var(--C-TEXT-SECONDARY); }`);
    expect(problems).toEqual([]);
  });

  it("flags a component reading one half alone, but not the canonical blend", () => {
    expect(checkHalfReads(`.x { stroke: var(--C-SERIES-1-DARK); }`, "x.css")).toHaveLength(1);
    expect(checkHalfReads(`.x { stroke: ${blend("C-SERIES-1")}; }`, "x.css")).toEqual([]);
  });
});
