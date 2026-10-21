/**
 * Interprets the format's JSON Schema (validate-schema.ts) for path-precise
 * issues. Pass/fail is exactly the schema's: a union passes when any branch
 * does. When every branch fails, the one reported is the branch the value
 * evidently meant: its discriminator's branch, else the branch that applies
 * (its type matches, it requires a key the value has) and fails deepest. A
 * tie is one issue at the union, in the union's own words.
 *
 * One function does both jobs: with no sink it stops at the first failure
 * (the silent probe a union uses to score its branches), with one it reports
 * everything. Sharing the code is what keeps the probe and the report from
 * disagreeing.
 */

import { isPlainObject } from "./guards";
import { makeIssue } from "./issue";
import { appendPointer } from "./pointer";
import { ISSUE_CODE_INFO, type Issue, type IssueCode, type JsonPrimitive } from "./types";
import { codePoints, type JsonType, lookupRef, type SchemaDef, type SchemaDefs } from "./validate-schema";
import { suggest, suggestValue } from "./validate-suggest";

/** A failure: whether the value has the failing schema's shape at all, and how deep it failed. */
interface Miss {
  readonly applies: boolean;
  readonly depth: number;
}

type Fit = Miss | null;

function jsonTypeOf(value: unknown): Exclude<JsonType, "integer"> | "other" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isPlainObject(value)) return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isFinite(value) ? "number" : "other";
  return "other";
}

/** A schema's `type`, as a list (empty when it has none). */
function typesOf(schema: SchemaDef): readonly JsonType[] {
  return typeof schema.type === "string" ? [schema.type] : (schema.type ?? []);
}

function matchesType(value: unknown, type: JsonType): boolean {
  const actual = jsonTypeOf(value);
  if (type === "integer") return actual === "number" && Number.isInteger(value);
  return actual === type;
}

const TYPE_WORDS: { readonly [T in JsonType]: string } = {
  null: "null",
  boolean: "a boolean",
  number: "a number",
  integer: "a whole number",
  string: "a string",
  array: "an array",
  object: "an object",
};

function describeValue(value: unknown): string {
  const type = jsonTypeOf(value);
  return type === "other" ? `a non-JSON ${typeof value}` : TYPE_WORDS[type];
}

function quote(value: JsonPrimitive): string {
  return JSON.stringify(value);
}

/** Own keys whose value is present (an `undefined` value counts as absent, as in JSON). */
function presentKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}

const ANNOTATIONS = new Set(["$ref", "title", "description", "x-issue", "x-message", "x-discriminator"]);

export class SchemaInterpreter {
  private readonly patterns = new Map<string, RegExp>();

  constructor(private readonly defs: SchemaDefs) {}

  /** Every issue `value` raises against `schema`, its paths under `path`. */
  validate(schema: SchemaDef, value: unknown, path: string): Issue[] {
    const sink: Issue[] = [];
    this.check(schema, value, path, depthOf(path), sink);
    return sink;
  }

  /** Whether `value` conforms, without building issues. */
  accepts(schema: SchemaDef, value: unknown): boolean {
    return this.check(schema, value, "", 0, null) === null;
  }

  resolve(schema: SchemaDef): SchemaDef {
    let current = schema;
    while (current.$ref !== undefined) {
      const target = lookupRef(this.defs, current.$ref).def;
      const extra = Object.keys(current).filter((key) => !ANNOTATIONS.has(key));
      if (extra.length > 0) throw new Error(`Schema $ref ${current.$ref} has validation keywords beside it: ${extra.join(", ")}.`);
      current = target;
    }
    return current;
  }

  private regex(pattern: string): RegExp {
    let regex = this.patterns.get(pattern);
    if (regex === undefined) {
      regex = new RegExp(pattern, "u");
      this.patterns.set(pattern, regex);
    }
    return regex;
  }

  /**
   * The recursive path (check → array/object/union → check) holds every
   * nesting level's frames at once, so it keeps them small: scalar keywords
   * and messages live in helpers that return before the descent.
   */
  private check(raw: SchemaDef, value: unknown, path: string, depth: number, sink: Issue[] | null): Fit {
    const schema = this.resolve(raw);
    if (schema.type !== undefined && !this.typeMatches(schema, value, path, sink)) return { applies: false, depth };
    let first = this.scalar(schema, value, path, depth, sink);
    if (first !== null && sink === null) return first;
    let miss: Fit = null;
    if (Array.isArray(value)) miss = this.checkArray(schema, value, path, depth, sink);
    else if (isPlainObject(value)) miss = this.checkObject(schema, value, path, depth, sink);
    first ??= miss;
    if (first !== null && sink === null) return first;
    if (schema.anyOf !== undefined) first ??= this.checkUnion(schema, value, path, depth, sink);
    return first;
  }

  private say(schema: SchemaDef, sink: Issue[] | null, fallback: IssueCode, path: string, message: string, suggestion?: string): void {
    sink?.push(makeIssue(schema["x-issue"] ?? fallback, path, schema["x-message"] ?? message, suggestion));
  }

  private typeMatches(schema: SchemaDef, value: unknown, path: string, sink: Issue[] | null): boolean {
    const types = typesOf(schema);
    if (types.some((type) => matchesType(value, type))) return true;
    const expected = types.map((type) => TYPE_WORDS[type]).join(" or ");
    const extra = schema["x-message"] === undefined ? "" : ` ${schema["x-message"]}`;
    sink?.push(makeIssue(schema["x-issue"] ?? "invalid-type", path, `Expected ${expected}, got ${describeValue(value)}.${extra}`));
    return false;
  }

  /** `const`, `enum` and the string and number keywords: the first miss, all of them reported. */
  private scalar(schema: SchemaDef, value: unknown, path: string, depth: number, sink: Issue[] | null): Fit {
    const misses: [IssueCode, string, string?][] = [];
    if (schema.const !== undefined && value !== schema.const) misses.push(["invalid-value", `Must be ${quote(schema.const)}.`]);
    if (schema.enum !== undefined && !schema.enum.includes(value as JsonPrimitive)) {
      misses.push(["invalid-value", `Must be one of ${schema.enum.map(quote).join(", ")}.`, suggestValue(value, schema.enum)]);
    }
    if (typeof value === "string") {
      const length = schema.minLength !== undefined || schema.maxLength !== undefined ? codePoints(value) : 0;
      if (schema.minLength !== undefined && length < schema.minLength) {
        misses.push(["invalid-value", schema.minLength === 1 ? "Must not be empty." : `At least ${schema.minLength} characters.`]);
      }
      if (schema.maxLength !== undefined && length > schema.maxLength) {
        misses.push(["invalid-value", `At most ${schema.maxLength} characters (this has ${length}).`]);
      }
      if (schema.pattern !== undefined && !this.regex(schema.pattern).test(value)) misses.push(["invalid-value", `Must match ${schema.pattern}.`]);
    }
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) misses.push(["invalid-value", `At least ${schema.minimum}.`]);
      if (schema.maximum !== undefined && value > schema.maximum) misses.push(["invalid-value", `At most ${schema.maximum}.`]);
    }
    for (const [code, message, suggestion] of misses) this.say(schema, sink, code, path, message, suggestion);
    return misses.length === 0 ? null : { applies: true, depth };
  }

  private checkArray(schema: SchemaDef, value: readonly unknown[], path: string, depth: number, sink: Issue[] | null): Fit {
    let first: Fit = null;
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      this.say(schema, sink, "invalid-value", path, schema.minItems === 1 ? "Must not be empty." : `At least ${schema.minItems} items.`);
      first = { applies: true, depth };
      if (sink === null) return first;
    }
    const items = schema.items;
    if (items === undefined) return first;
    for (let index = 0; index < value.length; index += 1) {
      const miss = this.check(items, value[index], sink === null ? "" : appendPointer(path, index), depth + 1, sink);
      if (miss === null) continue;
      first ??= { applies: true, depth: miss.depth };
      if (sink === null) return first;
    }
    return first;
  }

  /** Whether an object branch has the value's shape: a required key present, every constant matching. */
  private objectApplies(schema: SchemaDef, value: Record<string, unknown>): boolean {
    const required = schema.required ?? [];
    if (required.length > 0 && !required.some((key) => value[key] !== undefined && Object.hasOwn(value, key))) return false;
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (property.const !== undefined && Object.hasOwn(value, key) && value[key] !== undefined && value[key] !== property.const) return false;
    }
    return true;
  }

  private checkObject(schema: SchemaDef, value: Record<string, unknown>, path: string, depth: number, sink: Issue[] | null): Fit {
    const applies = this.objectApplies(schema, value);
    // A probe stops at a branch that is not this value's shape before descending into it.
    if (!applies && sink === null) return { applies, depth };
    const keys = presentKeys(value);
    let first: Fit = this.objectKeys(schema, keys, path, sink) ? { applies, depth } : null;
    if (first !== null && sink === null) return first;
    for (const key of keys) {
      const child = this.propertySchema(schema, key);
      if (child === undefined) continue;
      const miss = this.check(child, value[key], sink === null ? "" : appendPointer(path, key), depth + 1, sink);
      if (miss === null) continue;
      first ??= { applies, depth: miss.depth };
      if (sink === null) return first;
    }
    return first;
  }

  /** The schema a key's value answers to, or undefined when none constrains it. */
  private propertySchema(schema: SchemaDef, key: string): SchemaDef | undefined {
    if (schema.properties !== undefined && Object.hasOwn(schema.properties, key)) return schema.properties[key];
    for (const [pattern, child] of Object.entries(schema.patternProperties ?? {})) if (this.regex(pattern).test(key)) return child;
    return schema.additionalProperties === false ? undefined : schema.additionalProperties;
  }

  /** The keywords about an object's keys: `required`, closed objects, `propertyNames`, `minProperties`. Whether any failed. */
  private objectKeys(schema: SchemaDef, keys: readonly string[], path: string, sink: Issue[] | null): boolean {
    let failed = false;
    const fail = (issue: () => Issue): boolean => {
      failed = true;
      sink?.push(issue());
      return sink === null;
    };
    for (const key of schema.required ?? []) {
      if (!keys.includes(key) && fail(() => makeIssue(schema["x-issue"] ?? "missing-key", path, `Missing \`${key}\`.`))) return true;
    }
    if (schema.additionalProperties === false) {
      const known = Object.keys(schema.properties ?? {});
      for (const key of keys) {
        if (this.propertySchema(schema, key) !== undefined) continue;
        const message = `Unknown key \`${key}\`; this object takes ${known.map((name) => `\`${name}\``).join(", ")}.`;
        if (fail(() => makeIssue("unknown-key", appendPointer(path, key), message, suggest(key, known)))) return true;
      }
    }
    if (schema.propertyNames !== undefined) {
      const names = this.resolve(schema.propertyNames);
      for (const key of keys) {
        if (this.check(names, key, "", 0, null) === null) continue;
        const message = names["x-message"] ?? `The key \`${key}\` is not allowed here.`;
        if (fail(() => makeIssue(names["x-issue"] ?? "invalid-value", appendPointer(path, key), message))) return true;
      }
    }
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      fail(() => makeIssue(schema["x-issue"] ?? "invalid-value", path, `At least ${schema.minProperties} keys.`));
    }
    return failed;
  }

  /** Whether `schema` takes values of `value`'s JSON type at all. */
  private admits(raw: SchemaDef, value: unknown): boolean {
    const schema = this.resolve(raw);
    if (schema.type !== undefined && !typesOf(schema).some((type) => matchesType(value, type))) return false;
    return schema.anyOf === undefined || schema.anyOf.some((branch) => this.admits(branch, value));
  }

  /** The constant(s) a branch's discriminator property takes, or undefined when it has none. */
  private discriminatorValues(branch: SchemaDef, key: string): readonly JsonPrimitive[] | undefined {
    const property = this.resolve(branch).properties?.[key];
    if (property === undefined) return undefined;
    if (property.const !== undefined) return [property.const];
    return property.enum;
  }

  private checkUnion(schema: SchemaDef, value: unknown, path: string, depth: number, sink: Issue[] | null): Fit {
    const pool = this.narrow(schema, value, path, depth, sink);
    if (isMiss(pool)) return pool;
    const candidates = this.probe(pool, value, depth);
    if (candidates === null) return null;
    const chosen = choose(candidates);
    if (chosen === undefined) return this.unionMiss(schema, pool, candidates, value, path, depth, sink);
    if (sink !== null) this.check(chosen.branch, value, path, depth, sink);
    return chosen.miss;
  }

  /**
   * The branches still in play once the discriminator has ruled some out
   * (they would fail anyway, so they are never probed), or the miss when it
   * rules out all of them or is missing.
   */
  private narrow(schema: SchemaDef, value: unknown, path: string, depth: number, sink: Issue[] | null): readonly SchemaDef[] | Miss {
    const pool = schema.anyOf ?? [];
    const key = schema["x-discriminator"];
    if (key === undefined || !isPlainObject(value)) return pool;
    const accepted = pool.map((branch) => this.discriminatorValues(branch, key));
    const allowed = accepted.flatMap((values) => values ?? []);
    if (value[key] === undefined || !Object.hasOwn(value, key)) {
      const required = pool.every((branch, index) => accepted[index] !== undefined && this.resolve(branch).required?.includes(key));
      if (!required) return pool;
      sink?.push(makeIssue("missing-key", path, `Missing \`${key}\`: one of ${allowed.map(quote).join(", ")}.`));
      return { applies: true, depth };
    }
    const given = value[key];
    const narrowed = pool.filter((_, index) => accepted[index]?.includes(given as JsonPrimitive) ?? true);
    if (narrowed.length > 0) return narrowed;
    const message = `\`${key}\` is one of ${allowed.map(quote).join(", ")}.`;
    sink?.push(makeIssue("invalid-value", appendPointer(path, key), message, suggestValue(given, allowed)));
    return { applies: true, depth: depth + 1 };
  }

  /** Each branch's miss, or null as soon as one branch passes. */
  private probe(pool: readonly SchemaDef[], value: unknown, depth: number): Candidate[] | null {
    const candidates: Candidate[] = [];
    for (const branch of pool) {
      const miss = this.check(branch, value, "", depth, null);
      if (miss === null) return null;
      candidates.push({ branch, miss });
    }
    return candidates;
  }

  /** No one branch is the evident intent: one issue at the union, in its own words. */
  private unionMiss(
    schema: SchemaDef,
    pool: readonly SchemaDef[],
    candidates: readonly Candidate[],
    value: unknown,
    path: string,
    depth: number,
    sink: Issue[] | null,
  ): Miss {
    if (sink !== null) {
      const fallback: IssueCode = pool.some((branch) => this.admits(branch, value)) ? "invalid-value" : "invalid-type";
      const titles = pool.map((branch) => this.resolve(branch).title).filter((title) => title !== undefined);
      const message = schema.description ?? `Expected one of: ${titles.join(", ")}; got ${describeValue(value)}.`;
      sink.push(makeIssue(schema["x-issue"] ?? fallback, path, message));
    }
    const applying = candidates.filter((candidate) => candidate.miss.applies);
    return applying.length > 0 ? { applies: true, depth: Math.max(...applying.map((c) => c.miss.depth)) } : { applies: false, depth };
  }
}

function isMiss(value: readonly SchemaDef[] | Miss): value is Miss {
  return !Array.isArray(value);
}

interface Candidate {
  readonly branch: SchemaDef;
  readonly miss: Miss;
}

/** The branch that applies and fails deepest, when exactly one does. */
function choose(candidates: readonly Candidate[]): Candidate | undefined {
  const applying = candidates.filter((candidate) => candidate.miss.applies);
  const deepest = Math.max(...applying.map((candidate) => candidate.miss.depth));
  const best = applying.filter((candidate) => candidate.miss.depth === deepest);
  return best.length === 1 ? best[0] : undefined;
}

function depthOf(path: string): number {
  if (path === "") return 0;
  let count = 0;
  for (const char of path) if (char === "/") count += 1;
  return count;
}
