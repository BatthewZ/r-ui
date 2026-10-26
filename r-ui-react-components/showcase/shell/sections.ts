import type { ComponentType } from "react";

/**
 * Component demo sections, discovered from `showcase/sections/<group>/<Name>.tsx`.
 *
 * A section file exports:
 *   export const meta = { title: "Button", group: "primitives", order: 10 };
 *   export default function ButtonSection() { … }
 *
 * `group` is the component group (the folder name, by convention); `order`
 * sorts within the group (ties break on title). A later agent adds a file and
 * nothing else: the Overview's index, the group's page and the sidebar pick it up.
 */
export interface SectionMeta {
  title: string;
  group: string;
  order: number;
  /** One line under the title: what the demo proves. */
  description?: string;
  /**
   * `open`: the demo frame is not a scroll container. For a demo whose
   * scroll-driven effect must follow the page: a view timeline attaches to the
   * nearest scroll container, and the frame's own (sideways) scroller would be
   * it. Default `scroller` (a wide demo scrolls inside its frame).
   */
  frame?: "scroller" | "open";
}

export interface Section {
  id: string;
  path: string;
  meta: SectionMeta;
  Component: ComponentType;
}

export interface SectionGroup {
  group: string;
  sections: Section[];
}

export interface InvalidSection {
  path: string;
  reason: string;
}

/**
 * The known groups, sorted by what a builder reaches for: everyday building
 * blocks first, app-wide setup last. Their order here is the reading order
 * everywhere; a group not listed follows in `OTHER_CATEGORY`, alphabetically.
 */
export const CATEGORIES: readonly { title: string; groups: readonly string[] }[] = [
  { title: "Foundations", groups: ["primitives", "layout", "content"] },
  { title: "Forms", groups: ["form", "dates", "filters", "steps"] },
  { title: "Feedback & overlays", groups: ["feedback", "overlays", "disclosure"] },
  { title: "Navigation & actions", groups: ["navigation", "toolbar", "commands", "guards"] },
  { title: "Data", groups: ["data", "charts", "boards"] },
  { title: "Marketing", groups: ["marketing", "media", "motion"] },
  { title: "Theming & locale", groups: ["preferences", "locale", "tokens"] },
];

export const OTHER_CATEGORY = "More";

const GROUP_ORDER = CATEGORIES.flatMap((c) => c.groups);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const PATH = /sections\/([^/]+)\/([^/]+)\.tsx$/;

/**
 * A section's anchor id, `<group>-<file>` (`./sections/data/DataTable.tsx` →
 * `data-datatable`), read from its path alone, so a route can pick sections
 * before loading any of them. The browser checks' tags mirror it
 * (`scripts/lib/browser-tags.mjs`).
 */
export function sectionIdOf(path: string): string | null {
  const m = PATH.exec(path);
  return m ? `${slug(m[1]!)}-${slug(m[2]!)}` : null;
}

function validate(path: string, mod: unknown): Section | InvalidSection {
  const m = mod as { meta?: Partial<SectionMeta>; default?: unknown; loadError?: string };
  if (m?.loadError) return { path, reason: `failed to load: ${m.loadError}` };
  const meta = m?.meta;
  if (!meta || typeof meta !== "object") return { path, reason: "no `meta` export" };
  if (typeof meta.title !== "string" || !meta.title) return { path, reason: "`meta.title` must be a string" };
  if (typeof meta.group !== "string" || !meta.group) return { path, reason: "`meta.group` must be a string" };
  if (typeof meta.order !== "number" || !Number.isFinite(meta.order)) {
    return { path, reason: "`meta.order` must be a number" };
  }
  if (typeof m.default !== "function") return { path, reason: "no default-exported component" };
  const id = sectionIdOf(path);
  // The id comes from the path, so the group must be the folder's: one name, read before loading.
  const folder = PATH.exec(path)?.[1];
  if (!id || meta.group !== folder) return { path, reason: `\`meta.group\` must be its folder's name ("${folder}")` };
  return {
    id,
    path,
    meta: meta as SectionMeta,
    Component: m.default as ComponentType,
  };
}

const rank = (g: string) => {
  const i = GROUP_ORDER.indexOf(g);
  return i === -1 ? GROUP_ORDER.length : i;
};
const byGroupOrder = (a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b);

/** "form" → "Form": a group's name as a heading. */
export const groupTitle = (group: string) => group.charAt(0).toUpperCase() + group.slice(1);

/** A group and its sections' ids, known from the paths alone. */
export interface GroupIndex {
  group: string;
  ids: string[];
}

/**
 * Every group and its section ids, in reading order, from the glob's paths
 * alone: the Overview's index, the sidebar and a group page's pick of which
 * sections to load all come from it without loading any section.
 */
export function indexSections(paths: readonly string[]): GroupIndex[] {
  const byGroup = new Map<string, string[]>();
  for (const path of paths) {
    const group = PATH.exec(path)?.[1];
    const id = sectionIdOf(path);
    if (!group || !id) continue;
    byGroup.set(group, [...(byGroup.get(group) ?? []), id]);
  }
  return [...byGroup.entries()].sort(([a], [b]) => byGroupOrder(a, b)).map(([group, ids]) => ({ group, ids }));
}

/** A category and its groups present in the index, in reading order. */
export interface CategoryIndex {
  title: string;
  groups: GroupIndex[];
}

/** The index under its categories; a category with no group present is left out. */
export function categorise(index: readonly GroupIndex[]): CategoryIndex[] {
  const known = new Set(GROUP_ORDER);
  const categories = [
    ...CATEGORIES.map(({ title, groups }) => ({ title, groups: index.filter((g) => groups.includes(g.group)) })),
    { title: OTHER_CATEGORY, groups: index.filter((g) => !known.has(g.group)) },
  ];
  return categories.filter((c) => c.groups.length > 0);
}

/** What `#/overview/<anchor>` shows: the index, a group's page (at one of its sections), or nothing known. */
export type OverviewTarget =
  | { kind: "index" }
  | { kind: "group"; group: string; section: string | null }
  | { kind: "unknown"; anchor: string };

/**
 * Reads the Overview's anchor: a group name opens that group's page, a section
 * id opens its group's page at that section, so a link to a section keeps
 * working however the sections are paged.
 */
export function resolveOverview(index: readonly GroupIndex[], anchor: string | null): OverviewTarget {
  if (!anchor) return { kind: "index" };
  const group = index.find((g) => g.group === anchor);
  if (group) return { kind: "group", group: group.group, section: null };
  const holder = index.find((g) => g.ids.includes(anchor));
  return holder ? { kind: "group", group: holder.group, section: anchor } : { kind: "unknown", anchor };
}

/** Group, sort and validate a glob result. Pure, so it is tested without the glob. */
export function collectSections(modules: Record<string, unknown>): {
  groups: SectionGroup[];
  invalid: InvalidSection[];
} {
  const invalid: InvalidSection[] = [];
  const byGroup = new Map<string, Section[]>();
  for (const [path, mod] of Object.entries(modules)) {
    const result = validate(path, mod);
    if ("reason" in result) {
      invalid.push(result);
      continue;
    }
    const list = byGroup.get(result.meta.group) ?? [];
    list.push(result);
    byGroup.set(result.meta.group, list);
  }
  const groups = [...byGroup.entries()]
    .sort(([a], [b]) => byGroupOrder(a, b))
    .map(([group, sections]) => ({
      group,
      sections: sections.sort(
        (a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title),
      ),
    }));
  return { groups, invalid: invalid.sort((a, b) => a.path.localeCompare(b.path)) };
}

/** What the glob gives: one importer per section file. */
export type SectionImporters = Record<string, () => Promise<unknown>>;

/**
 * Imports the sections (all of them, or only those `ids` names, in which case
 * no other section's chunk is fetched) and collects them. A section whose chunk
 * fails is listed as invalid, not a blank page; an id no file answers is
 * `missing`.
 */
export async function loadModules(
  importers: SectionImporters,
  ids?: readonly string[],
): Promise<ReturnType<typeof collectSections> & { missing: string[] }> {
  const wanted = ids ? new Set(ids) : null;
  const picked = Object.entries(importers).filter(([path]) => !wanted || wanted.has(sectionIdOf(path) ?? ""));
  const entries = await Promise.all(
    picked.map(async ([path, importer]) => {
      const mod = await importer().catch((error: unknown) => ({ loadError: String(error) }));
      return [path, mod] as const;
    }),
  );
  const found = new Set(picked.map(([path]) => sectionIdOf(path)));
  return { ...collectSections(Object.fromEntries(entries)), missing: ids ? ids.filter((id) => !found.has(id)) : [] };
}
