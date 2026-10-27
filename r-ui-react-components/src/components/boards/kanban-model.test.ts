import { describe, expect, it } from "vitest";

import { cardsByColumn, columnAt, indexAt, moveItem, positionOf, slotsIn } from "./kanban-model";

const COLUMNS = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];
// Interleaved on purpose: a column's order is array order, wherever its cards sit.
const ITEMS = [
  { id: "a", columnId: "todo" },
  { id: "c", columnId: "doing" },
  { id: "b", columnId: "todo" },
  { id: "d", columnId: "doing" },
  { id: "x", columnId: "gone" },
];
const ids = (items: { id: string; columnId: string }[]) => items.map((i) => `${i.columnId}:${i.id}`).join(" ");

describe("cardsByColumn / positionOf / slotsIn", () => {
  it("groups by column in array order and leaves out cards of unknown columns", () => {
    const by = cardsByColumn(COLUMNS, ITEMS);
    expect([...by.keys()]).toEqual(["todo", "doing", "done"]);
    expect(by.get("todo")?.map((i) => i.id)).toEqual(["a", "b"]);
    expect(by.get("doing")?.map((i) => i.id)).toEqual(["c", "d"]);
    expect(by.get("done")).toEqual([]);
    expect(positionOf(by, "d")).toEqual({ column: "doing", index: 1 });
    expect(positionOf(by, "x")).toBeNull();
  });

  it("counts the places a card can land, never counting itself", () => {
    const by = cardsByColumn(COLUMNS, ITEMS);
    expect(slotsIn(by, "todo", "a")).toBe(2);
    expect(slotsIn(by, "doing", "a")).toBe(3);
    expect(slotsIn(by, "done", "a")).toBe(1);
  });
});

describe("moveItem", () => {
  it("moves down within a column, keeping every other card's order", () => {
    expect(ids(moveItem(ITEMS, "a", { column: "todo", index: 1 }))).toBe("doing:c todo:b todo:a doing:d gone:x");
  });

  it("moves up within a column", () => {
    expect(ids(moveItem(ITEMS, "d", { column: "doing", index: 0 }))).toBe("todo:a doing:d doing:c todo:b gone:x");
  });

  it("moves into another column at an index, updating columnId on a copy", () => {
    const next = moveItem(ITEMS, "a", { column: "doing", index: 1 });
    expect(ids(next)).toBe("doing:c todo:b doing:a doing:d gone:x");
    expect(ITEMS[0]).toEqual({ id: "a", columnId: "todo" });
  });

  it("puts a card past the end after the column's last card, and into an empty column at the end", () => {
    expect(ids(moveItem(ITEMS, "a", { column: "doing", index: 9 }))).toBe("doing:c todo:b doing:d doing:a gone:x");
    expect(ids(moveItem(ITEMS, "b", { column: "done", index: 0 }))).toBe("todo:a doing:c doing:d gone:x done:b");
  });

  it("returns an equal copy for an unknown card", () => {
    const next = moveItem(ITEMS, "nope", { column: "done", index: 0 });
    expect(next).toEqual(ITEMS);
    expect(next).not.toBe(ITEMS);
  });
});

describe("geometry", () => {
  it("indexAt counts the midpoints above the pointer", () => {
    expect(indexAt([], 10)).toBe(0);
    expect(indexAt([50, 110, 170], 10)).toBe(0);
    expect(indexAt([50, 110, 170], 60)).toBe(1);
    expect(indexAt([50, 110, 170], 500)).toBe(3);
  });

  it("columnAt picks the column under the pointer, else the nearest", () => {
    const boxes = [
      { id: "a", left: 0, right: 100 },
      { id: "b", left: 120, right: 220 },
    ];
    expect(columnAt(boxes, 50)).toBe("a");
    expect(columnAt(boxes, 150)).toBe("b");
    expect(columnAt(boxes, 108)).toBe("a");
    expect(columnAt(boxes, 115)).toBe("b");
    expect(columnAt(boxes, 900)).toBe("b");
    expect(columnAt([], 50)).toBeNull();
  });
});
