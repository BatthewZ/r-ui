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
 * nothing else: the Overview page and its TOC pick it up.
 */
export interface SectionMeta {
  title: string;
  group: string;
  order: number;
  /** One line under the title: what the demo proves. */
  description?: string;
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

/** Known groups in reading order; any other group follows, alphabetically. */
export const GROUP_ORDER = [
  "tokens",
  "primitives",
  "form",
  "dates",
  "disclosure",
  "overlays",
  "data",
  "charts",
  "content",
  "navigation",
  "layout",
  "motion",
  "preferences",
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
  const file = path.split("/").pop()?.replace(/\.tsx$/, "") ?? meta.title;
  return {
    id: `${slug(meta.group)}-${slug(file)}`,
    path,
    meta: meta as SectionMeta,
    Component: m.default as ComponentType,
  };
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
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i === -1 ? GROUP_ORDER.length : i;
  };
  const groups = [...byGroup.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([group, sections]) => ({
      group,
      sections: sections.sort(
        (a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title),
      ),
    }));
  return { groups, invalid: invalid.sort((a, b) => a.path.localeCompare(b.path)) };
}
