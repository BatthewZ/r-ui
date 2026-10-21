import { describe, expect, it } from "vitest";

import { coerceFieldValue } from "./form-values";
import { FIELD_TYPES } from "./types";

describe("coerceFieldValue", () => {
  it("gives each type's empty value for absent and null", () => {
    const empties = FIELD_TYPES.map((type) => [type, coerceFieldValue(type, undefined), coerceFieldValue(type, null)]);
    expect(empties).toEqual([
      ["text", { ok: true, value: "" }, { ok: true, value: "" }],
      ["number", { ok: true, value: null }, { ok: true, value: null }],
      ["boolean", { ok: true, value: false }, { ok: true, value: false }],
      ["date", { ok: true, value: null }, { ok: true, value: null }],
      ["dateRange", { ok: true, value: null }, { ok: true, value: null }],
      ["list", { ok: true, value: [] }, { ok: true, value: [] }],
    ]);
  });

  it("takes what the control can hold, converting where the forms do", () => {
    expect(coerceFieldValue("text", 42)).toEqual({ ok: true, value: "42" });
    expect(coerceFieldValue("number", "4.5")).toEqual({ ok: true, value: 4.5 });
    expect(coerceFieldValue("boolean", true)).toEqual({ ok: true, value: true });
    expect(coerceFieldValue("list", ["a", "b"])).toEqual({ ok: true, value: ["a", "b"] });
    const date = coerceFieldValue("date", "2026-11-02");
    expect(date.ok && date.value instanceof Date && date.value.getDate()).toBe(2);
    const range = coerceFieldValue("dateRange", { start: "2026-11-02", end: null });
    expect(range.ok && range.value).toEqual({ start: new Date(2026, 10, 2), end: null });
  });

  it("refuses what the control cannot hold, saying what it takes", () => {
    const refused = [
      coerceFieldValue("text", true),
      coerceFieldValue("number", "twelve"),
      coerceFieldValue("boolean", "yes"),
      coerceFieldValue("date", "2026-02-30"),
      coerceFieldValue("dateRange", { start: "soon" }),
      coerceFieldValue("list", ["a", 1]),
      coerceFieldValue("number", Infinity),
    ];
    expect(refused.map((result) => result.ok)).toEqual([false, false, false, false, false, false, false]);
    expect(refused[1]).toEqual({ ok: false, reason: "Not a number field's value (a number, or numeric text)." });
  });
});
