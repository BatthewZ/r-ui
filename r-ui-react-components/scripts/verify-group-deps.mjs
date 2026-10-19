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

import { groupGraph } from "./lib/group-graph.mjs";
import { PKG, pathArg } from "./lib/gate.mjs";

const { nodes, edges } = groupGraph(pathArg("--root", PKG));

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
