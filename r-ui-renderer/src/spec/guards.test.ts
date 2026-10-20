import { describe, expect, it } from "vitest";

import { isAction, isFormatMarker, isHandler, isNodeMarker, isRefMarker, nodeKind } from "./guards";

describe("markers", () => {
  it("are objects whose only key is the marker's", () => {
    expect(isRefMarker({ $ref: "data.x" })).toBe(true);
    expect(isRefMarker({ $ref: "data.x", label: "row data" })).toBe(false);
    expect(isRefMarker({ $ref: 3 })).toBe(false);
    expect(isNodeMarker({ $node: "text" })).toBe(true);
    expect(isFormatMarker({ $format: { value: 1, style: "percent" } })).toBe(true);
    expect(isFormatMarker({ $format: "percent" })).toBe(false);
  });

  it("never reads an inherited key", () => {
    const inherited = Object.create({ $ref: "data.x" }) as object;
    expect(isRefMarker(inherited)).toBe(false);
  });
});

describe("handlers", () => {
  it("are a known action with an optional payload, or a non-empty list of them", () => {
    const toast = { action: "showToast", payload: { title: "Saved" } };
    expect(isAction(toast)).toBe(true);
    expect(isHandler([toast, { action: "closeDialog", payload: { dialogId: "edit" } }])).toBe(true);
    expect(isHandler([])).toBe(false);
    expect(isAction({ action: "merged", payload: {} })).toBe(false);
    expect(isAction({ action: "showToast", payload: {}, extra: 1 })).toBe(false);
  });
});

describe("nodeKind", () => {
  it("names one shape, or none when the shape is ambiguous", () => {
    expect(nodeKind("Hello")).toBe("text");
    expect(nodeKind({ component: "Card" })).toBe("component");
    expect(nodeKind({ $each: "data.rows", as: "row", node: "x" })).toBe("each");
    expect(nodeKind({ $cond: "state.open", then: "x" })).toBe("cond");
    expect(nodeKind({ $format: { value: 1, style: "number" } })).toBe("format");
    expect(nodeKind({ $ref: "data.x" })).toBe("ref");
    expect(nodeKind({ component: "Card", $ref: "data.x" })).toBeNull();
    expect(nodeKind(42)).toBeNull();
    expect(nodeKind(null)).toBeNull();
  });
});
