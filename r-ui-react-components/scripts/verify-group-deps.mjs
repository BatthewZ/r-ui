#!/usr/bin/env node
// Asserts that the component groups (and the shared `hooks` and `util`) import
// each other without a cycle.
//
// Groups are built in parallel and each may use what sits below it. Two groups
// that each reach for the other (a palette in overlays using form's Input while
// a picker in form uses overlays' Popover) make every barrel import a potential
// module cycle, where a binding is read before its module has run. A component
// that needs two groups lives in a group above both (`commands`), and shared
// logic moves down to `util`.
//
// Edges come from every import and re-export (type-only too: a type import is
// still a design dependency) in shipped modules: `*.test.*` and `*.examples.*`
// are not modules of the library and may reach anywhere. The root barrel
// (`src/index.ts`) is a node too, so reaching a group through it is an edge.
// A string that names another group's class (`"r-form-frame"` written in
// dates) is an edge as well: borrowing a look by its class name is the same
// dependency as importing it, just invisible to the import graph. Comments
// never count.
//
// Usage: node scripts/verify-group-deps.mjs [--root <dir>]

import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { globSync } from "glob";
import ts from "typescript";

import { lineAt } from "./lib/css.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const ROOT = pathArg("--root", PKG);
const SRC = join(ROOT, "src");

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
  cwd: ROOT,
  absolute: true,
  nodir: true,
  ignore: ["**/*.test.*", "**/*.examples.*", "**/*.d.ts"],
}).sort();

const groups = new Set(files.map(nodeOf).filter((n) => n && !["hooks", "util", "index"].includes(n)));
const GROUP_CLASS = /(?:^|[^\w-])r-([a-z]+)-[\w-]/g;

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

/** from → to → the first `file:line` that made the edge. */
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
    if (!out.has(to)) out.set(to, `${relative(ROOT, file)}:${lineAt(text, pos)}`);
  };
  for (const { fileName, pos } of ts.preProcessFile(text, true, true).importedFiles) {
    if (fileName.startsWith(".")) addEdge(nodeOf(resolve(dirname(file), fileName)), pos);
  }
  for (const { to, pos } of classRefs(text, file)) addEdge(to, pos);
}

// Tarjan's strongly connected components: any with two or more nodes is a cycle.
let index = 0;
const order = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const cycles = [];
function visit(node) {
  order.set(node, index);
  low.set(node, index++);
  stack.push(node);
  onStack.add(node);
  for (const next of edges.get(node)?.keys() ?? []) {
    if (!order.has(next)) {
      visit(next);
      low.set(node, Math.min(low.get(node), low.get(next)));
    } else if (onStack.has(next)) {
      low.set(node, Math.min(low.get(node), order.get(next)));
    }
  }
  if (low.get(node) === order.get(node)) {
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1) cycles.push(component.sort());
  }
}
for (const node of [...nodes].sort()) if (!order.has(node)) visit(node);

const edgeCount = [...edges.values()].reduce((sum, out) => sum + out.size, 0);
if (nodes.size === 0 || edgeCount === 0) {
  console.error("verify:group-deps — no groups or no cross-group imports found; the scan is broken");
  process.exit(1);
}
if (cycles.length > 0) {
  const lines = cycles.map((members) => {
    const inside = new Set(members);
    const hops = members.flatMap((from) =>
      [...(edges.get(from) ?? [])].filter(([to]) => inside.has(to)).map(([to, at]) => `    ${from} → ${to}  (${at})`),
    );
    return `  ${members.join(" ⇄ ")}\n${hops.join("\n")}`;
  });
  console.error(
    `verify:group-deps — ${cycles.length} import cycle(s) between groups:\n${lines.join("\n")}\n\n` +
      "Groups import (and borrow classes) in one direction. Move a component that needs both\n" +
      "sides into a group above them, or move the shared piece down into util.",
  );
  process.exit(1);
}
console.log(`verify:group-deps — OK (${nodes.size} groups, ${edgeCount} cross-group edge(s), no cycle)`);
