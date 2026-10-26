import { describe, expect, it, vi } from "vitest";

import { componentAnchor, componentExports, indexComponents } from "./components";
import { collectSections, indexSections, type SectionGroup } from "./sections";

// The registry's own globs, loaded eagerly: the barrels as text and as modules, every section.
const barrels = import.meta.glob<string>("../../src/components/*/index.ts", { query: "?raw", import: "default", eager: true });
const barrelModules = import.meta.glob<Record<string, unknown>>("../../src/components/*/index.ts", { eager: true });
const sectionModules = import.meta.glob("../sections/*/*.tsx", { eager: true });

const sectionIndex = indexSections(Object.keys(sectionModules));
const { groups: sections } = collectSections(sectionModules);
const components = indexComponents(barrels, sectionIndex);

/** What a module really exports as a component: a PascalCase function or React element type. */
const realComponents = (mod: Record<string, unknown>) =>
  Object.entries(mod)
    .filter(([name, value]) => /^[A-Z][a-z]/.test(name) && (typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value)))
    .map(([name]) => name);

describe("componentExports", () => {
  it("reads value exports from the barrel convention, leaving types, constants and helpers out", () => {
    const source = [
      "// Button: one export line per component. export { Fake } from './x';",
      'export { Button, type ButtonProps, DEFAULT_BUTTON_LABELS } from "./Button";',
      "export {",
      "  Toolbar as Bar,",
      "  type ToolbarProps,",
      "  useToolbar,",
      '} from "./Toolbar";',
      'export type { Hidden } from "./types";',
      "/* export { Commented } from './c'; */",
    ].join("\n");
    expect(componentExports(source)).toEqual(["Button", "Bar"]);
  });

  it("equals every group barrel's real component exports", () => {
    const groups = Object.keys(barrels);
    expect(groups.length).toBeGreaterThan(15);
    for (const path of groups) {
      const real = realComponents(barrelModules[path] ?? {}).sort();
      expect({ path, names: componentExports(barrels[path] ?? "").sort() }).toEqual({ path, names: real });
    }
  });
});

describe("the palette's components", () => {
  const hosts = new Map<string, string[]>();
  for (const { sections: list } of sections) {
    for (const section of list) for (const name of section.meta.components ?? []) hosts.set(name, [...(hosts.get(name) ?? []), section.id]);
  }

  it("are every component the groups export, each found by its own section or exactly one host", () => {
    expect(components.length).toBeGreaterThan(100);
    expect(components.filter((c) => c.sectionId).length).toBeGreaterThan(80);
    const lost = components.filter((c) => !c.sectionId && (hosts.get(c.name) ?? []).length !== 1);
    expect(lost.map((c) => `${c.group}/${c.name}: hosted by ${JSON.stringify(hosts.get(c.name) ?? [])}`)).toEqual([]);
  });

  it("name only real components, and none that has a section of its own", () => {
    const byName = new Map(components.map((c) => [c.name, c]));
    expect(hosts.size).toBeGreaterThan(10);
    const wrong = [...hosts.keys()].filter((name) => !byName.has(name) || byName.get(name)?.sectionId);
    expect(wrong).toEqual([]);
  });

  it("find a section by its file name, in the component's own group", () => {
    const find = (name: string) => components.find((c) => c.name === name);
    expect(find("EventCalendar")).toEqual({ name: "EventCalendar", group: "dates", sectionId: "dates-eventcalendar" });
    expect(find("DataTable")?.sectionId).toBe("data-datatable");
    expect(find("RangeCalendar")).toEqual({ name: "RangeCalendar", group: "dates", sectionId: undefined });
  });
});

describe("componentAnchor", () => {
  const section = (id: string, components?: string[]) => ({ id, path: "", meta: { title: id, group: "g", order: 0, components }, Component: () => null });
  const loaded = (...list: ReturnType<typeof section>[]): Promise<{ groups: SectionGroup[] }> =>
    Promise.resolve({ groups: [{ group: "g", sections: list }] });

  it("opens a component's own section without loading anything", async () => {
    const group = vi.fn(() => loaded());
    const all = vi.fn(() => loaded());
    expect(await componentAnchor({ name: "Button", group: "primitives", sectionId: "primitives-button" }, { group, all })).toBe("primitives-button");
    expect(group).toHaveBeenCalledTimes(0);
    expect(all).toHaveBeenCalledTimes(0);
  });

  it("finds a hosted component in its own group first, then anywhere, then falls back to the group's page", async () => {
    const entry = { name: "Radio", group: "form" };
    const near = { group: vi.fn(() => loaded(section("form-radiogroup", ["Radio"]))), all: vi.fn(() => loaded()) };
    expect(await componentAnchor(entry, near)).toBe("form-radiogroup");
    expect(near.group.mock.calls).toEqual([["form"]]);
    expect(near.all).toHaveBeenCalledTimes(0);

    const far = { group: vi.fn(() => loaded()), all: vi.fn(() => loaded(section("layout-other"), section("form-formactions", ["Radio"]))) };
    expect(await componentAnchor(entry, far)).toBe("form-formactions");
    expect(far.all).toHaveBeenCalledTimes(1);

    const none = { group: vi.fn(() => loaded()), all: vi.fn(() => loaded(section("x"))) };
    expect(await componentAnchor(entry, none)).toBe("form");
  });
});
