import { describe, expect, it } from "vitest";

import { isAction, isFormatMarker, isHandler, isNodeMarker, isOneOf, isRefMarker, nodeKind, ownValue } from "./guards";

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

describe("a member whose value is undefined (a spec built in JavaScript)", () => {
  it("is absent, as the schema treats it", () => {
    expect(isRefMarker({ $ref: "data.x", label: undefined })).toBe(true);
    expect(isNodeMarker({ $node: undefined })).toBe(false);
    expect(isAction({ action: "showToast", payload: { title: "Saved" }, extra: undefined })).toBe(true);
    expect(nodeKind({ component: "Card", $ref: undefined })).toBe("component");
    expect(nodeKind({ component: undefined, $ref: "data.x" })).toBe("ref");
  });
});

describe("ownValue", () => {
  it("reads own properties only", () => {
    const record: Record<string, number> = { size: 1 };
    expect(ownValue(record, "size")).toBe(1);
    expect(ownValue(record, "constructor")).toBeUndefined();
    expect(ownValue(record, "__proto__")).toBeUndefined();
    expect(ownValue(record, "toString")).toBeUndefined();
  });
});

describe("isOneOf", () => {
  it("accepts exactly the list's members", () => {
    const sizes = ["sm", "md"] as const;
    expect(isOneOf(sizes, "sm")).toBe(true);
    expect(isOneOf(sizes, "lg")).toBe(false);
    expect(isOneOf(sizes, 1)).toBe(false);
    expect(isOneOf(sizes, "toString")).toBe(false);
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
