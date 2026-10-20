import { describe, expect, it } from "vitest";

import { collectSections, indexSections, resolveOverview } from "./sections";

// The same glob as the registry, loaded eagerly: the ids are the ones the group pages render.
const modules = import.meta.glob("../sections/*/*.tsx", { eager: true });
const sources = import.meta.glob<string>(["../sections/**/*.{ts,tsx}", "../pages/**/*.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const index = indexSections(Object.keys(modules));

describe("the Overview's anchors", () => {
  it("are never ambiguous: no group is named like a section", () => {
    const groups = new Set(index.map((g) => g.group));
    expect(groups.size).toBeGreaterThan(10);
    expect(index.flatMap((g) => g.ids).filter((id) => groups.has(id))).toEqual([]);
  });

  it("index exactly the sections that load", () => {
    const { groups, invalid } = collectSections(modules);
    expect(invalid).toEqual([]);
    expect(index.flatMap((g) => g.ids).sort()).toEqual(groups.flatMap((g) => g.sections.map((s) => s.id)).sort());
  });

  it("each hard-coded deep link names a group or a section", () => {
    const links = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(/#\/overview\/([a-z0-9-]+)/g)].map((m) => ({ path, anchor: m[1]! })),
    );
    expect(links.length).toBeGreaterThan(5);
    expect(links.filter(({ anchor }) => resolveOverview(index, anchor).kind === "unknown")).toEqual([]);
  });
});
