// @vitest-environment node
import { describe, expect, it } from "vitest";

import { defaultContracts } from "../contracts";
import { parseRefPath } from "./ref-path";
import {
  COMPONENT_NODE_KEYS,
  COND_NODE_KEYS,
  type DataTableColumnSpec,
  DOCUMENT_KEYS,
  EACH_NODE_KEYS,
  FORBIDDEN_SEGMENTS,
  type FormatOptions,
  type FormRefState,
  NAME_PATTERN,
  REF_ROOTS,
  type ApiBinding,
} from "./types";
import { FIELD_LIST_PROPS, PLACEMENT } from "./validate-advice";
import {
  ADVISORY_DEFS,
  API_BINDING_METHODS,
  COLUMN_FILTER_TYPES,
  COLUMN_PRIORITIES,
  CURRENCY_DISPLAYS,
  DATE_TIME_STYLES,
  FIRST_DIRECTIONS,
  FORM_STATE_KEYS,
  NOTATIONS,
  PATTERNS,
  SCHEMA_KEYWORDS,
  type SchemaDef,
  SIGN_DISPLAYS,
  TIME_ZONES,
  UNIT_DISPLAYS,
  VIEWSPEC_SCHEMA,
} from "./validate-schema";
import { SchemaInterpreter } from "./validate-structure";

/** Both ways, so a list that shrinks fails as surely as one that grows (a covariant check sees only growth). */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <A, B>(proof: Same<A, B>) => proof;

describe("the schema source", () => {
  it("spells each inline union of types.ts as the same list", () => {
    expect([
      same<(typeof NOTATIONS)[number], NonNullable<FormatOptions["notation"]>>(true),
      same<(typeof SIGN_DISPLAYS)[number], NonNullable<FormatOptions["signDisplay"]>>(true),
      same<(typeof CURRENCY_DISPLAYS)[number], NonNullable<FormatOptions["currencyDisplay"]>>(true),
      same<(typeof UNIT_DISPLAYS)[number], NonNullable<FormatOptions["unitDisplay"]>>(true),
      same<(typeof DATE_TIME_STYLES)[number], NonNullable<FormatOptions["dateStyle"]>>(true),
      same<(typeof DATE_TIME_STYLES)[number], NonNullable<FormatOptions["timeStyle"]>>(true),
      same<(typeof TIME_ZONES)[number], NonNullable<FormatOptions["timeZone"]>>(true),
      same<(typeof API_BINDING_METHODS)[number], NonNullable<ApiBinding["method"]>>(true),
      same<(typeof FIRST_DIRECTIONS)[number], NonNullable<DataTableColumnSpec["firstDirection"]>>(true),
      same<(typeof COLUMN_PRIORITIES)[number], NonNullable<DataTableColumnSpec["priority"]>>(true),
      same<(typeof COLUMN_FILTER_TYPES)[number], NonNullable<DataTableColumnSpec["filter"]>["type"]>(true),
      same<(typeof FORM_STATE_KEYS)[number], keyof FormRefState>(true),
      same<(typeof SCHEMA_KEYWORDS)[number], keyof SchemaDef>(true),
    ]).not.toContain(false);
  });

  it("uses only the keywords every reader knows, and every $ref names a definition", () => {
    const defs = ADVISORY_DEFS;
    const used = new Set<string>();
    const refs = new Set<string>();
    const walk = (schema: SchemaDef) => {
      for (const [key, value] of Object.entries(schema)) {
        used.add(key);
        if (key === "$ref") refs.add(value as string);
        else if (key === "properties" || key === "patternProperties") Object.values(value as Record<string, SchemaDef>).forEach(walk);
        else if (key === "anyOf") (value as SchemaDef[]).forEach(walk);
        else if (key === "items" || key === "propertyNames" || (key === "additionalProperties" && value !== false)) walk(value as SchemaDef);
      }
    };
    const { $defs, ...document } = VIEWSPEC_SCHEMA;
    walk(document);
    Object.values(defs).forEach(walk);
    expect([...used].filter((key) => !(SCHEMA_KEYWORDS as readonly string[]).includes(key))).toEqual([]);
    expect(refs.size).toBeGreaterThan(10);
    const interpreter = new SchemaInterpreter(defs);
    for (const ref of refs) expect(() => interpreter.resolve({ $ref: ref })).not.toThrow();
    expect(() => interpreter.resolve({ $ref: "#/$defs/Nothing" })).toThrow("names no definition");
    expect(Object.keys($defs).every((name) => Object.hasOwn(defs, name))).toBe(true);
  });

  it("lists each object's keys in the streaming order types.ts gives", () => {
    const properties = (schema: SchemaDef | undefined) => Object.keys(schema?.properties ?? {});
    const { $defs } = VIEWSPEC_SCHEMA;
    const node = new SchemaInterpreter($defs).resolve({ $ref: "#/$defs/ViewNode" });
    const branch = (title: string) => node.anyOf?.find((item) => item.title === title);
    expect(properties(VIEWSPEC_SCHEMA)).toEqual([...DOCUMENT_KEYS]);
    expect(properties(branch("Component node"))).toEqual([...COMPONENT_NODE_KEYS]);
    expect(properties(branch("$each node"))).toEqual([...EACH_NODE_KEYS]);
    expect(properties(branch("$cond node"))).toEqual([...COND_NODE_KEYS]);
  });

  it("reads a reference path exactly as parseRefPath does", () => {
    const pattern = new RegExp(PATTERNS.refPath, "u");
    const pieces = ["data", "row", "_x", "x1", "1x", "", ".", "..", "__proto__", "constructor", "prototype", "a b", "é", "length", "0", "$ref"];
    let checked = 0;
    let accepted = 0;
    for (const a of pieces) {
      for (const b of pieces) {
        for (const c of ["", ...pieces]) {
          for (const path of [`${a}.${b}${c}`, `${a}${b}.${c}`, `${a}.${b}.${c}`, a + b]) {
            const parsed = parseRefPath(path) !== null;
            expect(pattern.test(path), path).toBe(parsed);
            checked += 1;
            if (parsed) accepted += 1;
          }
        }
      }
    }
    expect(accepted).toBeGreaterThan(1000);
    expect(checked - accepted).toBeGreaterThan(1000);
  });

  it("reads a name as NAME_PATTERN does, minus the forbidden names, and an alias minus the roots too", () => {
    const name = new RegExp(PATTERNS.name, "u");
    const alias = new RegExp(PATTERNS.alias, "u");
    for (const candidate of ["row", "_x", "x_1", "Row", "1x", "a-b", "a.b", "", " a", ...FORBIDDEN_SEGMENTS, ...REF_ROOTS, "dataset", "events"]) {
      const forbidden = (FORBIDDEN_SEGMENTS as readonly string[]).includes(candidate);
      expect(name.test(candidate), candidate).toBe(NAME_PATTERN.test(candidate) && !forbidden);
      expect(alias.test(candidate), candidate).toBe(NAME_PATTERN.test(candidate) && !forbidden && !(REF_ROOTS as readonly string[]).includes(candidate));
    }
  });
});

describe("the validator's own tables name what the contracts have", () => {
  it("PLACEMENT and FIELD_LIST_PROPS", () => {
    const names = [...Object.keys(PLACEMENT), ...Object.values(PLACEMENT).flat(), ...Object.keys(FIELD_LIST_PROPS)];
    expect(names.filter((name) => !Object.hasOwn(defaultContracts, name))).toEqual([]);
    for (const [name, props] of Object.entries(FIELD_LIST_PROPS)) {
      const own = defaultContracts[name]?.props?.map((prop) => prop.name) ?? [];
      expect(props.filter((prop) => !own.includes(prop))).toEqual([]);
    }
  });
});
