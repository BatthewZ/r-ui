/**
 * Contract prop paths (`"href"`, `"items[].href"`, `"x[]"`, `"labels.title"`,
 * `"value.*"`): one parser and one walk for the renderer (which rewrites
 * resolved values, copy-on-write, so a value shared with data is never
 * mutated) and the validator (which reads the values a path reaches).
 */

import { isPlainObject } from "./guards";
import { appendPointer } from "./pointer";
import type { PropPath } from "./types";

type Step = { readonly kind: "key"; readonly key: string } | { readonly kind: "each" } | { readonly kind: "values" };

export interface ParsedPropPath {
  /** The top-level prop the path starts at. */
  readonly prop: string;
  /** What follows it; empty for the prop itself. */
  readonly steps: readonly Step[];
}

const parsed = new Map<PropPath, ParsedPropPath>();

export function parsePropPath(path: PropPath): ParsedPropPath {
  let result = parsed.get(path);
  if (result !== undefined) return result;
  const steps: Step[] = [];
  let prop: string | undefined;
  for (const part of path.split(".")) {
    const each = part.endsWith("[]");
    const name = each ? part.slice(0, -2) : part;
    if (prop === undefined) prop = name;
    else if (name === "*") steps.push({ kind: "values" });
    else if (name.length > 0) steps.push({ kind: "key", key: name });
    if (each) steps.push({ kind: "each" });
  }
  result = { prop: prop ?? "", steps };
  parsed.set(path, result);
  return result;
}

/** Removes the leaf: `transformAt`'s visitor returns it to drop a key or an element. */
export const DROP: unique symbol = Symbol("drop");

/**
 * What the visitor sees at each leaf `steps` reaches: the value, its JSON
 * Pointer (relative to the prop's) and whether it sits in an array or record
 * (`[]`, `*`) rather than at a named key.
 */
export type LeafVisitor = (value: unknown, pointer: string, inCollection: boolean) => unknown;

/**
 * `value` with `visit` applied at every leaf `steps` reaches. Returns `value`
 * itself when nothing changed. A leaf that is absent is not visited.
 */
export function transformAt(value: unknown, steps: readonly Step[], visit: LeafVisitor, pointer = "", inCollection = false): unknown {
  const [step, ...rest] = steps;
  if (step === undefined) return visit(value, pointer, inCollection);
  if (step.kind === "each") {
    if (!Array.isArray(value)) return value;
    let changed = false;
    const out: unknown[] = [];
    value.forEach((item: unknown, index) => {
      const next = transformAt(item, rest, visit, appendPointer(pointer, index), true);
      if (next !== item) changed = true;
      if (next !== DROP) out.push(next);
    });
    return changed ? out : value;
  }
  if (!isPlainObject(value)) return value;
  const keys = step.kind === "key" ? (Object.hasOwn(value, step.key) ? [step.key] : []) : Object.keys(value);
  let copy: Record<string, unknown> | undefined;
  for (const key of keys) {
    const item = value[key];
    const next = transformAt(item, rest, visit, appendPointer(pointer, key), step.kind === "values");
    if (next === item) continue;
    copy ??= { ...value };
    if (next === DROP) delete copy[key];
    else setOwn(copy, key, next);
  }
  return copy ?? value;
}

/** `target[key] = value` as an own property, even for `"__proto__"` (which JSON data may hold). */
export function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * Every value `path` reaches in `props`, with its JSON Pointer under `base`.
 * An absent step reaches nothing.
 */
export function valuesAt(props: Readonly<Record<string, unknown>>, path: PropPath, base: string): { path: string; value: unknown }[] {
  const { prop, steps } = parsePropPath(path);
  if (!Object.hasOwn(props, prop)) return [];
  const found: { path: string; value: unknown }[] = [];
  transformAt(props[prop], steps, (value, pointer) => {
    found.push({ path: appendPointer(base, prop) + pointer, value });
    return value;
  });
  return found;
}
