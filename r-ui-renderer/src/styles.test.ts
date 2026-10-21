// @vitest-environment node
/**
 * The stylesheet as a host's Tailwind build compiles it (on top of the CSS
 * package). Read from disk and compiled here: Vitest's own CSS handling turns
 * a stylesheet import into an empty string.
 */

import { join } from "node:path";

import { compile } from "@tailwindcss/node";
import { beforeAll, describe, expect, it } from "vitest";

import { RENDERER_CLASSES } from "./diagnostics";
import { HEADING_SIZES, TEXT_SIZES, TEXT_TONES, TEXT_WEIGHTS } from "./spec/types";

interface Rule {
  readonly selector: string;
  /** The enclosing at-rules, outermost first (`@layer components`). */
  readonly within: readonly string[];
  /** Everything between the rule's braces, nested blocks included. */
  readonly body: string;
}

/** Every style rule of compiled CSS (nested ones too) with the at-rules around it. */
function rules(css: string): Rule[] {
  const found: Rule[] = [];
  const open: { readonly prelude: string; readonly from: number }[] = [];
  let start = 0;
  for (let at = 0; at < css.length; at += 1) {
    const char = css[at];
    if (char === "{") {
      open.push({ prelude: css.slice(start, at).trim(), from: at + 1 });
      start = at + 1;
    } else if (char === "}") {
      const block = open.pop();
      if (block !== undefined && !block.prelude.startsWith("@")) {
        const within = open.map((outer) => outer.prelude).filter((prelude) => prelude.startsWith("@"));
        found.push({ selector: block.prelude, within, body: css.slice(block.from, at) });
      }
      start = at + 1;
    } else if (char === ";") {
      start = at + 1;
    }
  }
  return found;
}

describe("the renderer's stylesheet, compiled", () => {
  let compiled: string;
  let all: Rule[];
  beforeAll(async () => {
    const entry = `@import "@batthewz/r-ui-css";\n@import "./src/styles.css";\n`;
    compiled = (await compile(entry, { base: join(import.meta.dirname, ".."), onDependency() {} })).build([]);
    all = rules(compiled);
  });

  const ruleFor = (cls: string) => all.filter((rule) => rule.selector.split(",").some((part) => part.trim() === `.${cls}`));

  it("orders the components layer below utilities, so a document's className wins", () => {
    const order = /@layer theme, base, components, utilities;/.exec(compiled);
    expect(order).not.toBeNull();
  });

  const builtinClasses = [
    RENDERER_CLASSES.text,
    RENDERER_CLASSES.heading,
    RENDERER_CLASSES.icon,
    ...TEXT_SIZES.map((size) => `${RENDERER_CLASSES.text}-${size}`),
    ...HEADING_SIZES.map((size) => `${RENDERER_CLASSES.heading}-${size}`),
    ...TEXT_WEIGHTS.map((weight) => `${RENDERER_CLASSES.weight}-${weight}`),
    ...TEXT_TONES.map((tone) => `${RENDERER_CLASSES.tone}-${tone}`),
  ];

  it.each(builtinClasses)("styles .%s in the components layer only", (cls) => {
    const found = ruleFor(cls);
    expect(found.length).toBeGreaterThan(0);
    for (const rule of found) {
      expect(rule.within).toEqual(["@layer components"]);
      expect(rule.body.trim()).not.toBe("");
    }
  });

  it("lets a tone replace the heading's default colour (a later rule of equal weight)", () => {
    const heading = all.findIndex((rule) => rule.selector === `.${RENDERER_CLASSES.heading}` && rule.body.includes("color:"));
    const tone = all.findIndex((rule) => rule.selector === `.${RENDERER_CLASSES.tone}-muted`);
    expect(heading).toBeGreaterThan(-1);
    expect(tone).toBeGreaterThan(heading);
  });

  it("hides every diagnostic in a view whose diagnostics are hidden", () => {
    const selector = `.${RENDERER_CLASSES.view}[data-diagnostics="hidden"] .${RENDERER_CLASSES.diagnostic}`;
    const hiding = all.filter((rule) => rule.selector === selector);
    expect(hiding).toHaveLength(1);
    expect(hiding[0]?.within).toEqual(["@layer components"]);
    expect(hiding[0]?.body).toMatch(/display:\s*none;/);
  });

  it("contains the view, so a document's fixed positioning stays inside its box", () => {
    const [view] = ruleFor(RENDERER_CLASSES.view);
    expect(view?.within).toEqual(["@layer components"]);
    expect(view?.body).toMatch(/contain:\s*layout paint;/);
    expect(view?.body).toMatch(/isolation:\s*isolate;/);
  });
});
