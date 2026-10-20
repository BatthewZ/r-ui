import { afterEach, describe, expect, it } from "vitest";

import type { FormDef } from "../spec/types";
import { compileFormSchema, formDefaults, formDefHash, formDefProblems, type FormValues } from "./compile";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

function validate(def: FormDef, values: FormValues) {
  const result = compileFormSchema(def)["~standard"].validate(values);
  if (result instanceof Promise) throw new Error("the schema must be synchronous");
  return result;
}

function errors(def: FormDef, values: FormValues): Record<string, string> {
  const result = validate(def, values);
  return Object.fromEntries((result.issues ?? []).map((issue) => [String(issue.path?.[0]), issue.message]));
}

describe("compileFormSchema", () => {
  it("checks rules in order: required, then length, then pattern, then min/max", () => {
    const def: FormDef = {
      fields: { code: { rules: { required: true, minLength: 3, pattern: "^[a-z]+$", min: 5 } } },
    };
    expect(errors(def, { code: "" })).toEqual({ code: "This field is required." });
    expect(errors(def, { code: "AB" })).toEqual({ code: "Use at least 3 characters." });
    expect(errors(def, { code: "ABC" })).toEqual({ code: "This does not match the expected format." });
    expect(errors(def, { code: "abc" })).toEqual({});
  });

  it("counts false and an empty list as empty, so a required box must be ticked", () => {
    const def: FormDef = { fields: { terms: { type: "boolean", rules: { required: true } }, tags: { type: "list", rules: { required: true } } } };
    expect(Object.keys(errors(def, { terms: false, tags: [] }))).toEqual(["terms", "tags"]);
    expect(errors(def, { terms: true, tags: ["a"] })).toEqual({});
  });

  it("skips every other rule on an empty optional field", () => {
    const def: FormDef = { fields: { code: { rules: { minLength: 3, pattern: "^x$" } } } };
    expect(errors(def, { code: "" })).toEqual({});
  });

  it("uses messages per rule, then message, then the default", () => {
    const def: FormDef = {
      fields: { name: { rules: { required: true, maxLength: 2 }, message: "Bad name.", messages: { required: "Name, please." } } },
    };
    expect(errors(def, { name: "" })).toEqual({ name: "Name, please." });
    expect(errors(def, { name: "abc" })).toEqual({ name: "Bad name." });
  });

  it("counts characters, not UTF-16 units, and items of a list", () => {
    const def: FormDef = { fields: { emoji: { rules: { maxLength: 2 } }, picks: { type: "list", rules: { minLength: 2 } } } };
    expect(errors(def, { emoji: "😀😀", picks: ["a"] })).toEqual({ picks: "Use at least 2 items." });
  });

  it("fails a pattern on input longer than the cap without running it", () => {
    const def: FormDef = { fields: { text: { rules: { pattern: "^a+$" } } } };
    expect(errors(def, { text: "a".repeat(1000) })).toEqual({});
    expect(errors(def, { text: "a".repeat(1001) })).toEqual({ text: "This does not match the expected format." });
  });

  it("an invalid pattern can never pass, and is reported", () => {
    const def: FormDef = { fields: { text: { rules: { pattern: "(" } } } };
    expect(errors(def, { text: "x" })).toEqual({ text: "This does not match the expected format." });
    expect(formDefProblems(def).map((problem) => problem.path)).toEqual(["/fields/text/rules/pattern"]);
  });

  it("bounds numbers (and numeric text) and dates by their ISO day", () => {
    const def: FormDef = {
      fields: {
        seats: { type: "number", rules: { min: 1, max: 500 } },
        start: { type: "date", rules: { min: "2026-11-01", max: "2026-11-30" } },
        span: { type: "dateRange", rules: { max: "2026-12-31" } },
      },
    };
    expect(errors(def, { seats: 0, start: new Date(2026, 9, 31), span: { start: new Date(2026, 11, 1), end: new Date(2027, 0, 2) } })).toEqual({
      seats: "Must be at least 1.",
      start: "Choose 2026-11-01 or later.",
      span: "Choose 2026-12-31 or earlier.",
    });
    expect(errors(def, { seats: "501", start: new Date(2026, 10, 30), span: null })).toEqual({ seats: "Must be at most 500." });
  });

  it("outputs clean JSON: dates as ISO days, Sets as arrays", () => {
    const def: FormDef = { fields: { start: { type: "date" }, span: { type: "dateRange" }, name: {} } };
    const result = validate(def, { start: new Date(2026, 10, 2), span: { start: new Date(2026, 10, 2), end: null }, name: "Ada", extra: new Set(["x"]) });
    expect(result).toEqual({ value: { start: "2026-11-02", span: { start: "2026-11-02", end: null }, name: "Ada", extra: ["x"] } });
  });
});

describe("ISO ⇄ Date round trip", () => {
  it.each(["America/Los_Angeles", "Pacific/Honolulu", "Pacific/Auckland", "Asia/Kolkata"])("keeps the calendar day in %s", (tz) => {
    process.env.TZ = tz;
    const def: FormDef = {
      fields: { start: { type: "date", initialValue: "2026-11-02" }, span: { type: "dateRange", initialValue: { start: "2026-01-01", end: "2026-12-31" } } },
    };
    const values = formDefaults(def, () => undefined);
    const start = values.start as Date;
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 10, 2, 0]);
    expect(validate(def, values)).toEqual({ value: { start: "2026-11-02", span: { start: "2026-01-01", end: "2026-12-31" } } });
  });
});

describe("formDefaults", () => {
  it("gives each type its empty value and coerces what does not fit", () => {
    const def: FormDef = {
      fields: {
        name: {},
        seats: { type: "number", initialValue: "12" },
        on: { type: "boolean" },
        start: { type: "date", initialValue: "2026-02-30" },
        span: { type: "dateRange" },
        tags: { type: "list", initialValue: ["a", 2, "b"] },
      },
    };
    expect(formDefaults(def, () => undefined)).toEqual({ name: "", seats: 12, on: false, start: null, span: null, tags: ["a", "b"] });
  });

  it("reads a $ref initial value through the resolver", () => {
    const def: FormDef = { fields: { start: { type: "date", initialValue: { $ref: "data.plan.renewsOn" } } } };
    const seen: string[] = [];
    const values = formDefaults(def, (path) => {
      seen.push(path);
      return "2026-03-04";
    });
    expect(seen).toEqual(["data.plan.renewsOn"]);
    expect((values.start as Date).getDate()).toBe(4);
  });

  it("skips field keys that are not names", () => {
    const fields = JSON.parse('{"ok": {}, "__proto__": {}, "a.b": {}}') as FormDef["fields"];
    expect(Object.keys(formDefaults({ fields }, () => undefined))).toEqual(["ok"]);
  });
});

describe("formDefHash", () => {
  it("is structural: key order does not matter, any change does", () => {
    const a: FormDef = { fields: { name: { rules: { required: true } } }, validateOn: "blur" };
    const b = JSON.parse('{"validateOn": "blur", "fields": {"name": {"rules": {"required": true}}}}') as FormDef;
    const c: FormDef = { fields: { name: { rules: { required: false } } }, validateOn: "blur" };
    expect(formDefHash(a)).toBe(formDefHash(b));
    expect(formDefHash(a)).not.toBe(formDefHash(c));
  });
});
