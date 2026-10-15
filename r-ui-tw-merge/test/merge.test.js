// Merge behaviour: what `cn` keeps and what it drops, with plain tailwind-merge
// as the control that shows the mirror is doing the work.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { twMerge as plainTwMerge } from "tailwind-merge";

import { cn, createCn, mergeExtension, tailwindMergeExtension, twMerge } from "../src/index.js";
import { UTILITY, mirrorNames } from "./lib/mirror.js";

/** One representative utility per mirrored namespace. */
const PROBES = {
  color: (n) => `bg-${n}`,
  font: (n) => `font-${n}`,
  "font-weight": (n) => `font-${n}`,
  text: (n) => `text-${n}`,
  spacing: (n) => `p-${n}`,
  container: (n) => `max-w-${n}`,
  radius: (n) => `rounded-${n}`,
  shadow: (n) => `shadow-${n}`,
  ease: (n) => `ease-${n}`,
  animate: (n) => `animate-${n}`,
  opacity: (n) => `opacity-${n}`,
  "transition-duration": (n) => `duration-${n}`,
  "z-index": (n) => `z-${n}`,
  [UTILITY]: (n) => n,
};

describe("every mirrored name merges with its namespace siblings", () => {
  const mirror = mirrorNames(tailwindMergeExtension);
  test("every namespace has a probe", () => {
    assert.deepEqual([...mirror.keys()].sort(), Object.keys(PROBES).sort());
  });
  const siblings = (probe, names) => {
    // Single-name sets (opacity, a one-class @utility group) are covered by the pairs below.
    const [first, ...rest] = [...names];
    for (const name of rest) {
      assert.equal(cn(probe(first), probe(name)), probe(name));
      assert.equal(cn(probe(name), probe(first)), probe(first));
    }
  };
  for (const [ns, names] of mirror) {
    if (ns === UTILITY) continue;
    test(ns, () => siblings(PROBES[ns], names));
  }
  // Each `@utility` class group is its own conflict set: siblings within it merge,
  // and utilities in different groups both survive (see the pairs below).
  test(UTILITY, () => {
    const groups = Object.entries(tailwindMergeExtension.classGroups).filter(([, list]) =>
      list.every((item) => typeof item === "string"),
    );
    assert.ok(groups.length >= 2, "expected at least two @utility class groups");
    for (const [, list] of groups) siblings(PROBES[UTILITY], list);
  });
});

describe("conflicting pairs collapse to the last", () => {
  const pairs = [
    ["p-r3", "p-r5"],
    ["text-h1", "text-h2"],
    ["rounded-sm", "rounded-lg"],
    ["h-control", "h-row"],
    ["text-display-1", "text-prose-2"],
    ["text-body-1", "text-h6"],
    ["gap-r1", "gap-r6"],
    ["px-gutter", "px-r2"],
    ["py-section-1", "py-section-3"],
    ["size-icon", "size-hit"],
    ["max-w-measure", "max-w-full"],
    ["max-w-page", "max-w-measure"],
    ["min-w-column-sm", "min-w-column-lg"],
    ["font-ui", "font-mono"],
    ["font-heading", "font-display"],
    ["text-display-1", "text-h1"],
    ["z-raised", "z-bypass"],
    ["z-sticky", "z-10"],
    ["font-normal", "font-semibold"],
    ["shadow-sm", "shadow-lg"],
    ["ease-enter", "ease-exit"],
    ["duration-fast", "duration-slow"],
    ["animate-fade-in", "animate-scale-out"],
    ["opacity-disabled", "opacity-50"],
    ["text-fg-primary", "text-fg-muted"],
    ["bg-surface-1", "bg-surface-3"],
    ["focus-ring", "focus-ring-inset"],
    ["hover:bg-accent", "hover:bg-accent-hover"],
  ];
  for (const [a, b] of pairs) {
    test(`${a} ${b} -> ${b}`, () => {
      assert.equal(cn(a, b), b);
      assert.equal(cn(b, a), a);
    });
  }
});

describe("non-conflicting pairs survive", () => {
  const pairs = [
    ["text-h1", "text-fg-muted"],
    ["text-display-2", "text-fg-secondary"],
    ["bg-surface-1", "text-fg-primary"],
    ["border-border", "border-2"],
    ["text-h1", "font-medium"],
    ["font-display", "font-semibold"],
    // The type-role sizes carry a face; the family, case and figure utilities
    // override it in CSS, so tailwind-merge must keep both.
    ["text-h1", "font-mono"],
    ["text-h2", "font-ui"],
    ["text-display-1", "font-heading"],
    ["text-h6", "uppercase"],
    ["text-display-2", "tabular-nums"],
    ["z-sticky", "sticky"],
    ["h-control", "w-r6"],
    ["duration-fast", "ease-standard"],
    ["animate-fade-up", "duration-slow"],
    ["opacity-disabled", "bg-accent/10"],
    ["focus-visible:focus-ring", "outline-focus"],
    ["hit-area", "focus-ring"],
    ["md:p-r3", "p-r5"],
  ];
  for (const [a, b] of pairs) {
    test(`${a} + ${b}`, () => {
      assert.equal(cn(a, b), `${a} ${b}`);
      assert.equal(cn(b, a), `${b} ${a}`);
    });
  }
});

describe("controls: plain tailwind-merge gets these wrong", () => {
  // If these ever start passing on plain tailwind-merge, the pairs above stop
  // proving anything about the mirror.
  test("it keeps both r-scale paddings", () => {
    assert.equal(plainTwMerge("p-r3 p-r5"), "p-r3 p-r5");
    assert.equal(cn("p-r3 p-r5"), "p-r5");
  });
  test("it reads text-h1 as a colour and drops it", () => {
    assert.equal(plainTwMerge("text-h1 text-fg-muted"), "text-fg-muted");
    assert.equal(cn("text-h1 text-fg-muted"), "text-h1 text-fg-muted");
  });
  test("it does not know layer names", () => {
    assert.equal(plainTwMerge("z-10 z-sticky"), "z-10 z-sticky");
    assert.equal(cn("z-10 z-sticky"), "z-sticky");
  });
  test("it does not know ease, duration, opacity or animation names", () => {
    assert.equal(plainTwMerge("ease-in ease-standard"), "ease-in ease-standard");
    assert.equal(plainTwMerge("duration-150 duration-fast"), "duration-150 duration-fast");
    assert.equal(plainTwMerge("opacity-50 opacity-disabled"), "opacity-50 opacity-disabled");
    assert.equal(plainTwMerge("animate-spin animate-fade-in"), "animate-spin animate-fade-in");
  });
});

describe("tailwind-merge's own defaults keep working", () => {
  const pairs = [
    ["px-4", "px-8"],
    ["text-red-500", "text-blue-500"],
    ["rounded", "rounded-lg"],
    ["ease-in", "ease-standard"],
    ["duration-150", "duration-fast"],
    ["animate-spin", "animate-fade-in"],
    ["opacity-50", "opacity-disabled"],
    ["w-1/2", "w-r3"],
  ];
  for (const [a, b] of pairs) {
    test(`${a} ${b} -> ${b}`, () => assert.equal(cn(a, b), b));
  }
  test("twMerge (no clsx) is the same configuration", () => {
    assert.equal(twMerge("p-r3 p-r5", "text-h1 text-fg-muted"), "p-r5 text-h1 text-fg-muted");
  });
  test("clsx inputs", () => {
    assert.equal(cn("p-r3", false && "p-r1", null, undefined, { "text-h2": true, "text-h1": false }, ["p-r5"]), "text-h2 p-r5");
  });
});

describe("createCn: a downstream library adds its own names", () => {
  const chartCn = createCn({ theme: { spacing: ["chart"], text: ["figure"] } });

  test("an added spacing name conflicts with the built-ins", () => {
    assert.equal(cn("h-control h-chart"), "h-control h-chart", "control: unknown to the default cn");
    assert.equal(chartCn("h-control h-chart"), "h-chart");
    assert.equal(chartCn("h-chart h-row"), "h-row");
    assert.equal(chartCn("min-h-chart min-h-hit"), "min-h-hit");
  });

  test("an added text size is a size, not a colour", () => {
    assert.equal(cn("text-figure text-fg-muted"), "text-fg-muted", "control: the default cn reads it as a colour");
    assert.equal(chartCn("text-figure text-fg-muted"), "text-figure text-fg-muted");
    assert.equal(chartCn("text-h1 text-figure"), "text-figure");
  });

  test("the built-ins survive an extension of one namespace", () => {
    assert.equal(chartCn("p-r3 p-r5"), "p-r5");
    assert.equal(chartCn("rounded-sm rounded-lg"), "rounded-lg");
    assert.equal(chartCn("duration-fast duration-slow"), "duration-slow");
    assert.equal(chartCn("focus-ring focus-ring-inset"), "focus-ring-inset");
  });

  test("classGroups are concatenated onto the built-in groups", () => {
    const fadedCn = createCn({ classGroups: { opacity: [{ opacity: ["faint"] }], "stack-gap": ["stack-tight", "stack-loose"] } });
    assert.equal(fadedCn("opacity-disabled opacity-faint"), "opacity-faint");
    assert.equal(fadedCn("opacity-faint opacity-50"), "opacity-50");
    assert.equal(fadedCn("stack-tight stack-loose"), "stack-loose");
    assert.equal(fadedCn("duration-fast duration-slow"), "duration-slow");
  });

  test("conflictingClassGroups pass through", () => {
    const stackCn = createCn({
      classGroups: { "stack-gap": ["stack-tight"] },
      conflictingClassGroups: { "stack-gap": ["gap"] },
    });
    assert.equal(stackCn("gap-r3 stack-tight"), "stack-tight");
  });

  test("the built-in mirror is not mutated", () => {
    assert.ok(!tailwindMergeExtension.theme.spacing.includes("chart"));
    assert.ok(Object.isFrozen(tailwindMergeExtension.theme.spacing));
    assert.ok(Object.isFrozen(tailwindMergeExtension.classGroups.opacity[0].opacity));
  });
});

describe("mergeExtension", () => {
  test("returns a ConfigExtension: group keys under extend, static keys at the top", () => {
    const ext = mergeExtension({ theme: { spacing: ["chart"] }, cacheSize: 50, conflictingClassGroups: { a: ["b"] } });
    assert.equal(ext.cacheSize, 50);
    assert.equal(ext.extend.cacheSize, undefined);
    assert.deepEqual(ext.extend.theme.spacing, [...tailwindMergeExtension.theme.spacing, "chart"]);
    assert.deepEqual(ext.extend.conflictingClassGroups, { a: ["b"] });
    assert.equal(ext.theme, undefined);
  });

  test("rejects tailwind-merge's extend nesting instead of silently dropping it", () => {
    assert.throws(() => mergeExtension({ extend: { theme: { spacing: ["chart"] } } }), TypeError);
  });
});
