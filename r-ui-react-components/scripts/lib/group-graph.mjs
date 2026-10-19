// The import graph between component groups (plus `hooks`, `util` and the root
// barrel `index`), as `verify:group-deps` defines it: every import and re-export
// (type-only too) in shipped modules, and every string that names another
// group's `r-<group>-` class. `*.test.*` and `*.examples.*` files and comments
// never count. The gate fails on a cycle in it; `browser:check --changed` walks
// it backwards to find the groups a change can reach.

import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { globSync } from "glob";
import ts from "typescript";

import { lineAt } from "./css.mjs";

const GROUP_CLASS = /(?:^|[^\w-])r-([a-z]+)-[\w-]/g;

/**
 * `{ nodes, edges }` for the package at `root`: `edges` maps from → to → the
 * first `file:line` that made the edge.
 */
export function groupGraph(root) {
  const SRC = join(root, "src");

  /**
   * The node a source path belongs to: `form`, `hooks`, `util`, or `index` for the
   * package's root barrel (it re-exports every group, so a group importing it is a
   * cycle); null outside them.
   */
  function nodeOf(path) {
    const rel = relative(SRC, path).split("\\").join("/");
    const group = rel.match(/^components\/([^/]+)(?:\/|$)/);
    if (group) return group[1];
    const shared = rel.match(/^(hooks|util)(?:\/|$)/);
    if (shared) return shared[1];
    return /^(?:index(?:\.[jt]sx?)?)?$/.test(rel) ? "index" : null;
  }

  const files = globSync("src/{index.ts,{components,hooks,util}/**/*.{ts,tsx}}", {
    cwd: root,
    absolute: true,
    nodir: true,
    ignore: ["**/*.test.*", "**/*.examples.*", "**/*.d.ts"],
  }).sort();

  const groups = new Set(files.map(nodeOf).filter((n) => n && !["hooks", "util", "index"].includes(n)));

  /** Positions of every `r-<group>-…` class in the file's string literals (comments skipped). */
  function classRefs(text, file) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const refs = [];
    const visit = (node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
        for (const m of node.text.matchAll(GROUP_CLASS)) if (groups.has(m[1])) refs.push({ to: m[1], pos: node.getStart(sf) });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return refs;
  }

  const edges = new Map();
  const nodes = new Set();
  for (const file of files) {
    const from = nodeOf(file);
    if (!from) continue;
    nodes.add(from);
    const text = readFileSync(file, "utf8");
    const addEdge = (to, pos) => {
      if (!to || to === from) return;
      if (!edges.has(from)) edges.set(from, new Map());
      const out = edges.get(from);
      if (!out.has(to)) out.set(to, `${relative(root, file)}:${lineAt(text, pos)}`);
    };
    for (const { fileName, pos } of ts.preProcessFile(text, true, true).importedFiles) {
      if (fileName.startsWith(".")) addEdge(nodeOf(resolve(dirname(file), fileName)), pos);
    }
    for (const { to, pos } of classRefs(text, file)) addEdge(to, pos);
  }
  return { nodes, edges };
}

/** `start` and every node that reaches one of them through the graph (its dependants), sorted. */
export function dependants({ edges }, start) {
  const reached = new Set(start);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [from, out] of edges) {
      if (reached.has(from)) continue;
      if ([...out.keys()].some((to) => reached.has(to))) {
        reached.add(from);
        grew = true;
      }
    }
  }
  return [...reached].sort();
}
