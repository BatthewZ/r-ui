import { type GroupIndex, type SectionGroup } from "./sections";

/*
 * Every component the library's groups export, and where the showcase demos
 * it, for the command palette. Known without loading a section or a component:
 * the names are read from the group barrels' source text, and a component's own
 * section from the section files' paths. Only a component shown inside another
 * component's section (`RangeCalendar` in Calendar's) is resolved when it is
 * picked, from the sections' `meta.components`.
 */

/** A library component and where to find it. */
export interface ComponentEntry {
  name: string;
  /** Its group (the folder under `src/components/`). */
  group: string;
  /** The section named after it, when it has one. */
  sectionId?: string;
}

const lower = (s: string) => s.toLowerCase();

/**
 * The components a group barrel exports: its PascalCase value exports. Types,
 * `DEFAULT_*` and other constants, hooks and helpers are left out. Reads the
 * barrel convention (`export { A, type B, C as D } from "./x";`), which a test
 * holds against the barrel's real exports.
 */
export function componentExports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const names: string[] = [];
  for (const [, typeOnly, list = ""] of code.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    if (typeOnly) continue;
    for (const item of list.split(",")) {
      const spec = item.trim();
      if (!spec || spec.startsWith("type ")) continue;
      const name = spec.split(/\s+as\s+/).pop() ?? "";
      if (/^[A-Z][a-z]/.test(name)) names.push(name);
    }
  }
  return names;
}

const BARREL = /components\/([^/]+)\/index\.ts$/;

/**
 * Every component, in the order the showcase reads its groups, each matched to
 * the section of its group whose file bears its name (`DataTable` →
 * `data-datatable`).
 */
export function indexComponents(barrels: Record<string, string>, sections: readonly GroupIndex[]): ComponentEntry[] {
  const groupOf = new Map(
    Object.entries(barrels).flatMap(([path, source]) => {
      const group = BARREL.exec(path)?.[1];
      return group ? [[group, componentExports(source)] as const] : [];
    }),
  );
  const order = [...sections.map((s) => s.group), ...[...groupOf.keys()].sort()];
  return [...new Set(order)].flatMap((group) =>
    (groupOf.get(group) ?? []).map((name) => {
      const own = `${group}-${lower(name)}`;
      const sectionId = sections.find((s) => s.group === group)?.ids.includes(own) ? own : undefined;
      return { name, group, sectionId };
    }),
  );
}

/** The section whose `meta.components` lists `name`, among loaded `groups`. */
export function hostSection(name: string, groups: readonly SectionGroup[]): string | undefined {
  for (const { sections } of groups) {
    for (const section of sections) if (section.meta.components?.includes(name)) return section.id;
  }
  return undefined;
}

/**
 * The anchor to open for `entry`: its own section, else the section that hosts
 * it (its own group's sections first, the only ones the page will load), else
 * its group's page.
 */
export async function componentAnchor(
  entry: ComponentEntry,
  load: { group: (group: string) => Promise<{ groups: SectionGroup[] }>; all: () => Promise<{ groups: SectionGroup[] }> },
): Promise<string> {
  if (entry.sectionId) return entry.sectionId;
  const near = hostSection(entry.name, (await load.group(entry.group)).groups);
  return near ?? hostSection(entry.name, (await load.all()).groups) ?? entry.group;
}
