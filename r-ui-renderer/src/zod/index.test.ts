// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { RUNTIME_ISSUE_CODES } from "../spec/types";
import { validateViewSpec } from "../spec/validate";
import { publishedSchema, type SchemaDef } from "../spec/validate-schema";
import { SchemaInterpreter } from "../spec/validate-structure";
import { viewSpecSchema } from "./index";

// One kitchen-sink document that touches every shape the format has, then
// hand-made breaks of each rule, then thousands of seeded random mutations:
// the validator, the Zod schema and the published JSON Schema must agree on
// every one.

const SINK = {
  $schema: "https://example.test/viewspec.json",
  version: 2,
  title: "Service health",
  description: "Everything at once.",
  density: "compact",
  state: { tab: "overview", filters: { region: null }, picked: [] },
  data: {
    summary: { type: "static", value: { uptime: 0.9993, $ref: "data, not a marker", rows: [{ id: 1 }] } },
    services: { type: "api", endpoint: "/api/services", method: "POST", query: { region: { $ref: "state.filters.region" }, limit: 50, all: true, none: null }, body: { tab: { $ref: "state.tab" } } },
    incidents: { type: "source", source: "incidents", params: { open: true, since: { $ref: "state.tab" } } },
  },
  forms: {
    contact: {
      fields: {
        name: { rules: { required: true, minLength: 2, maxLength: 80 }, message: "Tell us your name." },
        email: { type: "text", rules: { required: true, pattern: "^[^@\\s]+@[^@\\s]+$" }, messages: { pattern: "An email address." } },
        seats: { type: "number", initialValue: 5, rules: { min: 1, max: 500 } },
        terms: { type: "boolean", initialValue: false, rules: { required: true } },
        start: { type: "date", initialValue: { $ref: "data.summary.start" }, rules: { min: "2026-01-01" } },
        stay: { type: "dateRange", initialValue: { start: "2026-01-01", end: "2026-01-05" } },
        tags: { type: "list", initialValue: ["a"], rules: { maxLength: 3 } },
      },
      validateOn: "blur",
      revalidateOn: "change",
      onSubmit: {
        action: "apiCall",
        payload: {
          endpoint: "/api/contact",
          method: "PUT",
          query: { draft: false },
          body: { $ref: "event.value" },
          into: "state.result",
          onSuccess: [{ action: "showToast", payload: { title: "Sent", tone: "success" } }, { action: "resetForm", payload: { form: "contact" } }],
          onError: { action: "showToast", payload: { title: { $ref: "event.value.message" }, description: { $format: { value: 3, style: "integer" } }, tone: "error" } },
        },
      },
      onInvalid: { action: "setState", payload: { path: "state.errors", value: { $ref: "event.value" } } },
    },
  },
  root: {
    component: "Stack",
    props: { gap: "r3", "data-section": "main", className: "p-r3" },
    children: [
      "Plain text",
      { $ref: "data.summary.uptime" },
      { $format: { value: { $ref: "data.summary.uptime" }, style: "percent", maximumFractionDigits: 1 } },
      { $format: { value: 12.5, style: "currency", currency: "EUR", currencyDisplay: "code" } },
      { $format: { value: 30, style: "unit", unit: "millisecond", unitDisplay: "short" } },
      { $format: { value: "2026-11-02", style: "date", dateStyle: "medium", timeZone: "UTC", missing: "–" } },
      { $each: "data.services", as: "svc", key: "meta.id", node: { component: "Badge", children: [{ $ref: "svc.name" }, { $ref: "svcIndex" }] } },
      { $cond: "data.services", then: "Some", else: "None" },
      { $cond: { not: { ref: "state.tab", eq: "overview" } }, then: "x" },
      { $cond: { ref: "status.services", ne: { $ref: "state.tab" } }, then: "x" },
      { $cond: { ref: "data.summary.uptime", gt: 0.99 }, then: "x" },
      { $cond: { ref: "state.tab", lt: "m" }, then: "x" },
      { $cond: { ref: "state.tab", in: ["a", { deep: [1] }] }, then: "x" },
      { $cond: { ref: "state.tab", in: { $ref: "state.picked" } }, then: "x" },
      {
        component: "Button",
        props: {
          variant: "primary",
          onClick: [
            { action: "setState", payload: { path: "state.tab", value: { merged: { $ref: "event.args.0" } } } },
            { action: "submitForm", payload: { form: "contact" } },
            { action: "navigate", payload: { to: { $ref: "data.summary.link" }, replace: true } },
            { action: "openDialog", payload: { dialogId: "details" } },
            { action: "closeDialog", payload: { dialogId: "details" } },
          ],
        },
        children: ["Go"],
      },
      {
        component: "Widget",
        props: {
          header: { $node: { component: "Badge", children: ["New"] } },
          items: [{ label: "a", onSelect: { action: "navigate", payload: { to: "/a" } }, onHover: "dropped" }, { $ref: "x", other: 1 }],
          action: { action: "data under another key", payload: 1 },
          onEmpty: [],
          nothing: null,
          options: [1, "two", false, { $format: { value: 1, style: "compact" } }],
        },
      },
      { component: "Dialog", props: { dialogId: "details" }, children: [{ component: "Dialog.Content", children: ["Hi"] }] },
    ],
  },
} as const;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** `doc` with the value at `path` (keys and indices) replaced by `edit(old)`; `undefined` deletes it. */
function edit(doc: Json, path: readonly (string | number)[], change: (old: Json | undefined) => Json | undefined): Json {
  const copy = clone(doc);
  if (path.length === 0) return change(copy) ?? null;
  let parent: Json = copy;
  for (const step of path.slice(0, -1)) parent = (parent as Record<string | number, Json>)[step] as Json;
  const last = path[path.length - 1] as string | number;
  const next = change((parent as Record<string | number, Json>)[last]);
  if (Array.isArray(parent) && typeof last === "number") {
    if (next === undefined) parent.splice(last, 1);
    else parent[last] = next;
  } else if (next === undefined) delete (parent as Record<string, Json>)[last];
  else Object.defineProperty(parent, last, { value: next, enumerable: true, writable: true, configurable: true });
  return copy;
}

const at = (...path: (string | number)[]) => path;

/** Each breaks exactly one conformance rule. */
const BROKEN: [string, Json][] = [
  ["no root", edit(SINK as unknown as Json, at("root"), () => undefined)],
  ["version 1", edit(SINK as unknown as Json, at("version"), () => 1)],
  ["empty title", edit(SINK as unknown as Json, at("title"), () => "")],
  ["a theme", edit(SINK as unknown as Json, at("theme"), () => "aurora")],
  ["bad density", edit(SINK as unknown as Json, at("density"), () => "cosy")],
  ["state name with a dot", edit(SINK as unknown as Json, at("state", "a.b"), () => 1)],
  ["state __proto__", edit(SINK as unknown as Json, at("state", "__proto__"), () => 1)],
  ["binding type", edit(SINK as unknown as Json, at("data", "services", "type"), () => "rest")],
  ["binding method", edit(SINK as unknown as Json, at("data", "services", "method"), () => "DELETE")],
  ["query list holding an object", edit(SINK as unknown as Json, at("data", "services", "query", "x"), () => ["a", { a: 1 }])],
  ["field type", edit(SINK as unknown as Json, at("forms", "contact", "fields", "seats", "type"), () => "integer")],
  ["rule bound", edit(SINK as unknown as Json, at("forms", "contact", "fields", "name", "rules", "minLength"), () => 1.5)],
  ["message for no rule", edit(SINK as unknown as Json, at("forms", "contact", "fields", "name", "messages"), () => ({ length: "x" }))],
  ["empty handler list", edit(SINK as unknown as Json, at("forms", "contact", "onInvalid"), () => [])],
  ["unknown action", edit(SINK as unknown as Json, at("root", "children", 14, "props", "onClick", 0, "action"), () => "set")],
  ["setState path not state", edit(SINK as unknown as Json, at("root", "children", 14, "props", "onClick", 0, "payload", "path"), () => "data.x")],
  ["setState replace as ref", edit(SINK as unknown as Json, at("root", "children", 14, "props", "onClick", 0, "payload", "replace"), () => ({ $ref: "state.tab" }))],
  ["empty $concat", edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), () => ({ $concat: [] }))],
  ["$concat with an object part", edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), () => ({ $concat: ["a", { b: 1 }] }))],
  ["$concat with a null part", edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), () => ({ $concat: ["a", null] }))],
  ["literal key as ref", edit(SINK as unknown as Json, at("root", "children", 14, "props", "onClick", 1, "payload", "form"), () => ({ $ref: "state.form" }))],
  ["toast tone", edit(SINK as unknown as Json, at("forms", "contact", "onSubmit", "payload", "onError", "payload", "tone"), () => "loud")],
  ["nested handler", edit(SINK as unknown as Json, at("forms", "contact", "onSubmit", "payload", "onSuccess", 0, "payload"), () => ({}))],
  ["number node", edit(SINK as unknown as Json, at("root", "children", 0), () => 7)],
  ["two node keys", edit(SINK as unknown as Json, at("root", "children", 1, "component"), () => "Card")],
  ["alias reserved", edit(SINK as unknown as Json, at("root", "children", 6, "as"), () => "state")],
  ["each without node", edit(SINK as unknown as Json, at("root", "children", 6, "node"), () => undefined)],
  ["key with empty segment", edit(SINK as unknown as Json, at("root", "children", 6, "key"), () => "meta..id")],
  ["two operators", edit(SINK as unknown as Json, at("root", "children", 10, "$cond", "lt"), () => 1)],
  ["gt an object", edit(SINK as unknown as Json, at("root", "children", 10, "$cond", "gt"), () => ({ a: 1 }))],
  ["bad ref grammar", edit(SINK as unknown as Json, at("root", "children", 1, "$ref"), () => "data.")],
  ["currency without currency", edit(SINK as unknown as Json, at("root", "children", 3, "$format", "currency"), () => undefined)],
  ["format digits", edit(SINK as unknown as Json, at("root", "children", 2, "$format", "maximumFractionDigits"), () => 101)],
  ["sole $ref with a bad path in props", edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), () => ({ $ref: "a..b" }))],
  ["sole $node with no node", edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), () => ({ $node: { x: 1 } }))],
  ["action-like under on…", edit(SINK as unknown as Json, at("root", "children", 15, "props", "items", 0, "onSelect", "action"), () => "go")],
  ["children not an array", edit(SINK as unknown as Json, at("root", "children", 16, "children"), () => "Hi")],
  ["empty component", edit(SINK as unknown as Json, at("root", "children", 16, "component"), () => "")],
];

/** Conforming edits that stress the edges. */
const BENT: [string, Json][] = [
  ["astral title at the limit", edit(SINK as unknown as Json, at("title"), () => "😀".repeat(200))],
  ["markers inside static data", edit(SINK as unknown as Json, at("data", "summary", "value"), () => ({ $node: 5, $ref: 1 }))],
  ["setState replacing", edit(SINK as unknown as Json, at("root", "children", 14, "props", "onClick", 0, "payload", "replace"), () => true)],
  ["query list and object (a warning)", edit(edit(SINK as unknown as Json, at("data", "services", "query", "x"), () => ({ a: 1 })), at("data", "services", "query", "tags"), () => ["a", 2, null, { $ref: "state.tab" }])],
  ["$concat in a prop and a payload", edit(edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), (): Json => ({ $concat: ["mailto:", { $ref: "state.tab" }, 1, true, { $format: { value: 2, style: "compact" } }] })), at("root", "children", 14, "props", "onClick", 2, "payload", "to"), () => ({ $concat: ["/s/", { $ref: "state.tab" }] }))],
  ["an action as data", edit(SINK as unknown as Json, at("root", "children", 15, "props", "nothing"), () => ({ action: "nope" }))],
  ["a list of non-actions under on…", edit(SINK as unknown as Json, at("root", "children", 15, "props", "onEmpty"), () => [1, { a: 2 }])],
  ["unknown component (a warning)", edit(SINK as unknown as Json, at("root", "children", 16, "component"), () => "Nope")],
];

const PUBLISHED = publishedSchema() as SchemaDef & { readonly $defs: { readonly [name: string]: SchemaDef } };
const { $defs: publishedDefs, ...publishedDocument } = PUBLISHED;
const published = new SchemaInterpreter(publishedDefs);

function verdicts(doc: Json, validator = validateViewSpec(doc)) {
  return {
    validator: validator.ok,
    zod: viewSpecSchema.safeParse(doc).success,
    schema: published.accepts(publishedDocument, doc),
  };
}

/** A seeded generator (mulberry32), so a failure reproduces. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paths(value: Json, prefix: (string | number)[] = []): (string | number)[][] {
  const here = [prefix];
  if (Array.isArray(value)) return [...here, ...value.flatMap((item, index) => paths(item, [...prefix, index]))];
  if (value !== null && typeof value === "object") return [...here, ...Object.entries(value).flatMap(([key, item]) => paths(item, [...prefix, key]))];
  return here;
}

const REPLACEMENTS: Json[] = [
  null,
  true,
  0,
  -1.5,
  "",
  "x",
  "state.tab",
  "data..x",
  [],
  {},
  { $ref: "state.tab" },
  { $ref: "a..b" },
  { $node: "text" },
  { $node: 1 },
  { $format: { value: 1, style: "number" } },
  { action: "showToast", payload: { title: "t" } },
  { action: "nope", payload: {} },
  { component: "Card" },
  "submitForm",
  "GET",
  2,
];

function mutate(doc: Json, next: () => number): Json {
  const all = paths(doc).filter((path) => path.length > 0);
  const path = all[Math.floor(next() * all.length)] as (string | number)[];
  const pick = next();
  if (pick < 0.15) return edit(doc, path, () => undefined);
  if (pick < 0.25) {
    const last = path[path.length - 1];
    if (typeof last !== "string") return edit(doc, path, () => undefined);
    return edit(edit(doc, path, () => undefined), [...path.slice(0, -1), `${last}x`], () => 1);
  }
  if (pick < 0.32) return edit(doc, path, (old) => (old === undefined ? null : [old]));
  return edit(doc, path, () => REPLACEMENTS[Math.floor(next() * REPLACEMENTS.length)] ?? null);
}

describe("the validator, ./zod and schema.json agree on conformance", () => {
  it("accepts the kitchen sink everywhere, warning only of the two values it drops", () => {
    expect(validateViewSpec(SINK, { components: ["Widget"] }).issues.map((issue) => [issue.code, issue.path])).toEqual([
      ["forbidden-prop", "/root/children/15/props/items/0/onHover"],
      ["forbidden-prop", "/root/children/15/props/onEmpty"],
    ]);
    expect(verdicts(SINK as unknown as Json)).toEqual({ validator: true, zod: true, schema: true });
  });

  it.each(BROKEN)("rejects a document with %s everywhere", (_, doc) => {
    expect(verdicts(doc)).toEqual({ validator: false, zod: false, schema: false });
  });

  it.each(BENT)("accepts a document with %s everywhere", (_, doc) => {
    expect(verdicts(doc)).toEqual({ validator: true, zod: true, schema: true });
  });

  it("treats a member whose value is undefined as absent, as the validator does with a host-built value", () => {
    const button = (props: Record<string, unknown>) => ({ version: 2, title: "t", root: { component: "Button", props } });
    const absent: unknown[] = [
      { version: 2, title: "t", root: "x", extra: undefined },
      { version: 2, title: "t", state: { a: 1, b: undefined }, root: "x" },
      button({ onClick: { action: "navigate", payload: { to: "/", extra: undefined } } }),
      button({ icon: { $node: "x", extra: undefined } }),
      { version: 2, title: "t", root: { $cond: { ref: "state.a", eq: 1, ne: undefined }, then: "x" } },
    ];
    for (const doc of absent) {
      expect(validateViewSpec(doc).ok).toBe(true);
      expect(viewSpecSchema.safeParse(doc).success).toBe(true);
    }
    const present = { version: 2, title: "t", root: "x", extra: null };
    expect(validateViewSpec(present).ok).toBe(false);
    expect(viewSpecSchema.safeParse(present).success).toBe(false);
  });

  it("agrees on thousands of random mutations, which land on both answers", { timeout: 60_000 }, () => {
    const next = random(20261020);
    const tally = { valid: 0, invalid: 0 };
    const disagreements: unknown[] = [];
    let doc = SINK as unknown as Json;
    const codes = new Set<string>();
    for (let round = 0; round < 2000; round += 1) {
      // Mostly one edit from the sink, sometimes a walk of several.
      doc = mutate(round % 4 === 0 ? doc : (SINK as unknown as Json), next);
      const result = validateViewSpec(doc);
      const verdict = verdicts(doc, result);
      tally[verdict.validator ? "valid" : "invalid"] += 1;
      if (verdict.zod !== verdict.validator || verdict.schema !== verdict.validator) disagreements.push({ verdict, doc });
      for (const issue of result.issues) codes.add(issue.code);
    }
    for (const code of RUNTIME_ISSUE_CODES) expect(codes).not.toContain(code);
    expect(disagreements.slice(0, 3)).toEqual([]);
    expect(tally.valid).toBeGreaterThan(300);
    expect(tally.invalid).toBeGreaterThan(300);
  });
});

describe("schema.json", () => {
  it("is the published source, byte for byte", () => {
    const file = readFileSync(new URL("../schema.json", import.meta.url), "utf8");
    expect(file).toBe(`${JSON.stringify(publishedSchema(), null, 2)}\n`);
  });

  it("is never stricter than the validator under Zod's own JSON Schema reader, whose known gaps are asserted", () => {
    const fromJson = z.fromJSONSchema(publishedSchema() as Parameters<typeof z.fromJSONSchema>[0]);
    for (const [, doc] of [["sink", SINK as unknown as Json] as const, ...BENT]) expect(fromJson.safeParse(doc).success).toBe(true);
    // Zod 4.6 reads `additionalProperties` beside `patternProperties` as open, so a
    // prop that breaks only that rule slips through. Tighten this when it stops.
    const gap = BROKEN.find(([name]) => name === "sole $ref with a bad path in props")?.[1];
    expect(fromJson.safeParse(gap).success).toBe(true);
    expect(validateViewSpec(gap).ok).toBe(false);
  });
});
