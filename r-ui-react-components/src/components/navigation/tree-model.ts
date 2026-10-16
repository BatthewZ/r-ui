import type { ReactNode } from "react";

/** One node of a `TreeView`, given as data (`items`) or by `TreeView.Item`. */
export interface TreeNode {
  /** Unique across the whole tree: selection, expansion and DOM ids key on it. */
  id: string;
  label: ReactNode;
  /** What typeahead matches. Defaults to `label` when that is a string. */
  textValue?: string;
  /** Decorative glyph before the label. */
  icon?: ReactNode;
  /** Known children. `[]` is a leaf, even with `hasChildren`. */
  children?: readonly TreeNode[];
  /** Children exist but are not loaded: expanding calls the tree's `loadChildren(id)`. */
  hasChildren?: boolean;
  /** Not selectable, checkable or activatable; still focusable and expandable. */
  disabled?: boolean;
  /** Makes the node a link (the `RouterProvider`'s link for an internal href). */
  href?: string;
  /** This link is the page being shown. Unset, the router's `isCurrent(href)` decides. */
  current?: boolean;
}

export type TreeLoadState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "loaded"; children: readonly TreeNode[] };

export type TreeLoads = ReadonlyMap<string, TreeLoadState>;

export interface TreeEntry {
  node: TreeNode;
  parentId: string | null;
  /** Known children: given, or loaded. `undefined` while not loaded. */
  children: readonly TreeNode[] | undefined;
}

/** Every known node by id, collapsed ones included (a cascade reaches them), in tree order. */
export function indexTree(items: readonly TreeNode[], loads: TreeLoads): Map<string, TreeEntry> {
  const index = new Map<string, TreeEntry>();
  const walk = (nodes: readonly TreeNode[], parentId: string | null) => {
    for (const node of nodes) {
      const children = knownChildren(node, loads);
      index.set(node.id, { node, parentId, children });
      if (children) walk(children, node.id);
    }
  };
  walk(items, null);
  return index;
}

export function knownChildren(node: TreeNode, loads: TreeLoads): readonly TreeNode[] | undefined {
  if (node.children !== undefined) return node.children;
  const load = loads.get(node.id);
  return load?.status === "loaded" ? load.children : undefined;
}

/** Whether `node` still has to be loaded before it shows children. */
export function needsLoad(node: TreeNode, loads: TreeLoads, canLoad: boolean): boolean {
  return canLoad && node.children === undefined && node.hasChildren === true && loads.get(node.id)?.status !== "loaded";
}

export type TreeRow =
  | {
      kind: "node";
      key: string;
      node: TreeNode;
      level: number;
      setSize: number;
      posInSet: number;
      parentId: string | null;
      expandable: boolean;
      expanded: boolean;
    }
  | { kind: "loading"; key: string; parentId: string; level: number }
  | { kind: "error"; key: string; parentId: string; level: number };

/** The key of the row standing in for `parentId`'s children while they load or failed. */
export const statusRowKey = (kind: "loading" | "error", parentId: string) => `\u0000${kind}:${parentId}`;

/** The parent a `statusRowKey` stands under, or `null` for a node's key. */
export const statusRowParent = (key: string): string | null => (key.startsWith("\u0000") ? key.slice(key.indexOf(":") + 1) : null);

/** The rows on screen, in order: nodes under collapsed parents are left out. */
export function visibleRows(
  items: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  loads: TreeLoads,
  canLoad: boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (nodes: readonly TreeNode[], level: number, parentId: string | null) => {
    nodes.forEach((node, i) => {
      const children = knownChildren(node, loads);
      const pending = needsLoad(node, loads, canLoad);
      const expandable = children ? children.length > 0 : pending;
      const isOpen = expandable && expanded.has(node.id);
      rows.push({
        kind: "node",
        key: node.id,
        node,
        level,
        setSize: nodes.length,
        posInSet: i + 1,
        parentId,
        expandable,
        expanded: isOpen,
      });
      if (!isOpen) return;
      if (children) {
        walk(children, level + 1, node.id);
        return;
      }
      const status = loads.get(node.id)?.status;
      if (status === "error") rows.push({ kind: "error", key: statusRowKey("error", node.id), parentId: node.id, level: level + 1 });
      // Not started is drawn as loading too: the load starts in the commit's effect.
      else rows.push({ kind: "loading", key: statusRowKey("loading", node.id), parentId: node.id, level: level + 1 });
    });
  };
  walk(items, 1, null);
  return rows;
}

/** Every ancestor of `ids`, nearest first per id (a nav tree opens down to its current page). */
export function ancestorsOf(index: ReadonlyMap<string, TreeEntry>, ids: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    let parent = index.get(id)?.parentId ?? null;
    while (parent !== null && !out.has(parent)) {
      out.add(parent);
      parent = index.get(parent)?.parentId ?? null;
    }
  }
  return [...out];
}

export type CheckState = boolean | "mixed";

/**
 * The tri-state of every known node for a set of checked ids. A checked id
 * checks everything under it (children that load later included); a parent
 * none of whose own ids is listed is checked when all its known children are,
 * mixed when some are.
 */
export function checkStates(items: readonly TreeNode[], loads: TreeLoads, checked: ReadonlySet<string>): Map<string, CheckState> {
  const states = new Map<string, CheckState>();
  const visit = (node: TreeNode, inherited: boolean): CheckState => {
    const children = knownChildren(node, loads);
    const on = inherited || checked.has(node.id);
    let state: CheckState = on;
    if (children && children.length > 0) {
      const kids = children.map((child) => visit(child, on));
      if (!on) state = kids.every((k) => k === true) ? true : kids.some((k) => k !== false) ? "mixed" : false;
    }
    states.set(node.id, state);
    return state;
  };
  for (const node of items) visit(node, false);
  return states;
}

/**
 * The checked ids after the user toggles `id`, in tree order: every known node
 * that is fully checked. The toggle cascades to the node's descendants, never
 * into a disabled one (it keeps its state), and its ancestors follow: checked
 * when all their children are. A node whose enabled part is fully checked
 * unchecks; otherwise it checks. Ids the tree has not loaded are kept.
 */
export function toggleChecked(items: readonly TreeNode[], loads: TreeLoads, checked: ReadonlySet<string>, id: string): string[] {
  const index = indexTree(items, loads);
  const target = index.get(id);
  if (!target || target.node.disabled) return [...checked];
  const states = checkStates(items, loads, checked);
  const on = new Set([...states].filter(([, state]) => state === true).map(([key]) => key));

  // The cascade: the target and what is under it, stopping at disabled nodes.
  const cascade: TreeEntry[] = [];
  const collect = (entry: TreeEntry) => {
    cascade.push(entry);
    for (const child of entry.children ?? []) {
      const childEntry = index.get(child.id);
      if (childEntry && !child.disabled) collect(childEntry);
    }
  };
  collect(target);
  // Leaves (or unloaded nodes) decide: a parent with a disabled, unchecked child is never itself "on".
  const ends = cascade.filter((entry) => !entry.children || entry.children.length === 0);
  const check = ends.some((entry) => !on.has(entry.node.id));
  for (const entry of cascade) {
    if (check) on.add(entry.node.id);
    else on.delete(entry.node.id);
  }
  // A parent is on only when all its children are (a disabled one may be off),
  // or listing it would check that child by inheritance. Reversed pre-order:
  // children settle before their parent.
  const settle = (entry: TreeEntry) => {
    const kids = entry.children ?? [];
    if (kids.length === 0) return;
    if (kids.every((kid) => on.has(kid.id))) on.add(entry.node.id);
    else on.delete(entry.node.id);
  };
  for (const entry of [...cascade].reverse()) settle(entry);

  for (let parent = target.parentId; parent !== null; parent = index.get(parent)?.parentId ?? null) {
    const entry = index.get(parent);
    if (entry) settle(entry);
  }
  // Ids the tree does not know yet (under a parent not loaded) are the caller's: kept as given.
  return [...[...index.keys()].filter((key) => on.has(key)), ...[...checked].filter((key) => !index.has(key))];
}

/** Two id lists hold the same ids in the same order. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
