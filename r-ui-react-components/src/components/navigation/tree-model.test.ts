import { describe, expect, it } from "vitest";

import { checkStates, type TreeLoads, type TreeNode, toggleChecked, visibleRows } from "./tree-model";

const NONE: TreeLoads = new Map();

const PERMS: TreeNode[] = [
  {
    id: "billing",
    label: "Billing",
    children: [
      { id: "invoices", label: "Invoices" },
      { id: "refunds", label: "Refunds" },
      { id: "payouts", label: "Payouts", disabled: true },
    ],
  },
  { id: "reports", label: "Reports", children: [{ id: "export", label: "Export" }] },
  { id: "lazy", label: "Lazy", hasChildren: true },
];

const toggle = (checked: string[], id: string, loads: TreeLoads = NONE) => toggleChecked(PERMS, loads, new Set(checked), id);

describe("checkStates", () => {
  it("derives a parent from its children: all, some, none", () => {
    expect(checkStates(PERMS, NONE, new Set(["export"])).get("reports")).toBe(true);
    expect(checkStates(PERMS, NONE, new Set(["invoices"])).get("billing")).toBe("mixed");
    expect(checkStates(PERMS, NONE, new Set()).get("billing")).toBe(false);
  });

  it("passes a checked parent down to children that load later", () => {
    const loads: TreeLoads = new Map([["lazy", { status: "loaded", children: [{ id: "late", label: "Late" }] }]]);
    expect(checkStates(PERMS, loads, new Set(["lazy"])).get("late")).toBe(true);
  });
});

describe("toggleChecked", () => {
  it("checks a parent's enabled descendants and leaves a disabled one as it was", () => {
    expect(toggle([], "billing")).toEqual(["invoices", "refunds"]);
    expect(checkStates(PERMS, NONE, new Set(toggle([], "billing"))).get("billing")).toBe("mixed");
  });

  it("unchecks a parent whose enabled part is all checked, instead of re-checking it", () => {
    expect(toggle(["invoices", "refunds"], "billing")).toEqual([]);
  });

  it("checks the parent once its last child is checked, and unchecks it with any child", () => {
    expect(toggle([], "export")).toEqual(["reports", "export"]);
    expect(toggle(["reports", "export"], "export")).toEqual([]);
  });

  it("unchecking one child of a checked parent keeps its siblings", () => {
    const all = ["billing", "invoices", "refunds", "payouts"];
    expect(toggle(all, "refunds")).toEqual(["invoices", "payouts"]);
  });

  it("refuses a disabled node and keeps ids the tree has not loaded", () => {
    expect(toggle(["payouts"], "payouts")).toEqual(["payouts"]);
    expect(toggle(["ghost"], "export")).toEqual(["reports", "export", "ghost"]);
  });
});

describe("visibleRows", () => {
  it("lists only open branches, with level, set size and position", () => {
    const rows = visibleRows(PERMS, new Set(["reports"]), NONE, true);
    expect(rows.map((r) => (r.kind === "node" ? [r.node.id, r.level, r.setSize, r.posInSet] : r.kind))).toEqual([
      ["billing", 1, 3, 1],
      ["reports", 1, 3, 2],
      ["export", 2, 1, 1],
      ["lazy", 1, 3, 3],
    ]);
  });

  it("stands a loading row, then an error row, in for children that are not there", () => {
    expect(visibleRows(PERMS, new Set(["lazy"]), NONE, true).at(-1)?.kind).toBe("loading");
    const failed: TreeLoads = new Map([["lazy", { status: "error", error: new Error("x") }]]);
    expect(visibleRows(PERMS, new Set(["lazy"]), failed, true).at(-1)?.kind).toBe("error");
  });

  it("treats hasChildren as a leaf when nothing can load it", () => {
    const lazy = visibleRows(PERMS, new Set(), NONE, false).find((r) => r.kind === "node" && r.node.id === "lazy");
    expect(lazy?.kind === "node" && lazy.expandable).toBe(false);
  });
});
