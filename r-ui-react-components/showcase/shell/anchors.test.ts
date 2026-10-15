import { describe, expect, it } from "vitest";

import { collectSections } from "./sections";

// The same glob as the registry, loaded eagerly: the ids are the ones the Overview renders.
const modules = import.meta.glob("../sections/*/*.tsx", { eager: true });
const sources = import.meta.glob<string>(["../sections/**/*.{ts,tsx}", "../pages/**/*.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("hard-coded Overview deep links", () => {
  it("each names a section the Overview renders", () => {
    const { groups, invalid } = collectSections(modules);
    expect(invalid).toEqual([]);
    const ids = new Set(groups.flatMap((g) => g.sections.map((s) => s.id)));
    expect(ids.size).toBeGreaterThan(50);

    const links = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(/#\/overview\/([a-z0-9-]+)/g)].map((m) => ({ path, anchor: m[1] })),
    );
    expect(links.length).toBeGreaterThan(5);
    expect(links.filter(({ anchor }) => !ids.has(anchor!))).toEqual([]);
  });
});
