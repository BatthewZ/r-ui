import { describe, expect, it } from "vitest";

import { parseRefPath, readRef } from "./ref-path";

describe("parseRefPath", () => {
  it("splits a root and its segments; indices and odd keys are segments", () => {
    expect(parseRefPath("data.rows.0.p95-ms")).toEqual({ root: "data", segments: ["rows", "0", "p95-ms"] });
    expect(parseRefPath("row")).toEqual({ root: "row", segments: [] });
  });

  it.each(["", ".data", "data.", "data..x", "1data.x", "data.__proto__", "constructor", "state.a.prototype", "da ta.x"])(
    "refuses %j",
    (path) => {
      expect(parseRefPath(path)).toBeNull();
    },
  );
});

describe("readRef", () => {
  const scope = {
    data: { rows: [{ name: "api", tags: ["a", "b"] }], label: "hello" },
    row: { id: 7 },
  };

  it("reads own properties, array positions and lengths", () => {
    expect(readRef("data.rows.0.name", scope)).toBe("api");
    expect(readRef("data.rows.0.tags.length", scope)).toBe(2);
    expect(readRef("data.label.length", scope)).toBe(5);
    expect(readRef("row.id", scope)).toBe(7);
  });

  it("reads nothing from a prototype, a missing step or a root out of reach", () => {
    expect(readRef("data.rows.0.toString", scope)).toBeUndefined();
    expect(readRef("data.label.toUpperCase", scope)).toBeUndefined();
    expect(readRef("data.rows.1.name", scope)).toBeUndefined();
    expect(readRef("state.x", scope)).toBeUndefined();
    expect(readRef("hasOwnProperty", scope)).toBeUndefined();
  });
});
