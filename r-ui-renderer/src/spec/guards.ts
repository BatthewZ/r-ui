/**
 * Shape tests for the format's markers, nodes and handlers. Own properties
 * only, and a marker is an object whose ONLY key is the marker's: a row that
 * happens to carry a `$ref` field among others is data. A member whose value
 * is `undefined` is absent, as JSON (and the schema) would have it.
 */

import {
  ACTION_NAMES,
  type Action,
  type ActionName,
  type ComponentNode,
  type ConcatMarker,
  type CondNode,
  type EachNode,
  FORBIDDEN_SEGMENTS,
  type FormatMarker,
  type Handler,
  NAME_PATTERN,
  type NodeMarker,
  type RefMarker,
} from "./types";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const FORBIDDEN: ReadonlySet<string> = new Set<string>(FORBIDDEN_SEGMENTS);

/** `__proto__`, `constructor` or `prototype`: never a name, a path segment or a key passed on. */
export function isForbiddenSegment(key: string): boolean {
  return FORBIDDEN.has(key);
}

/** A name (`NAME_PATTERN`) that is not a forbidden segment: data, state, form, field, alias and dialog names. */
export function isName(value: unknown): value is string {
  return typeof value === "string" && NAME_PATTERN.test(value) && !FORBIDDEN.has(value);
}

/** `record[key]` when `key` is the record's own property: never an inherited one (`constructor`, `__proto__`). */
export function ownValue<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Whether `value` is one of `list`'s members: the one test for every closed set. */
export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Own keys whose value is not `undefined`. */
function presentKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}

function has(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key) && value[key] !== undefined;
}

function isSoleKey(value: unknown, key: string): value is Record<string, unknown> {
  return isPlainObject(value) && has(value, key) && presentKeys(value).length === 1;
}

export function isRefMarker(value: unknown): value is RefMarker {
  return isSoleKey(value, "$ref") && typeof value.$ref === "string";
}

export function isNodeMarker(value: unknown): value is NodeMarker {
  return isSoleKey(value, "$node");
}

export function isFormatMarker(value: unknown): value is FormatMarker {
  return isSoleKey(value, "$format") && isPlainObject(value.$format);
}

export function isConcatMarker(value: unknown): value is ConcatMarker {
  return isSoleKey(value, "$concat") && Array.isArray(value.$concat);
}

const ACTIONS: ReadonlySet<string> = new Set<string>(ACTION_NAMES);

export function isActionName(value: unknown): value is ActionName {
  return typeof value === "string" && ACTIONS.has(value);
}

/** `{ action, payload? }` with a known action and nothing else. */
export function isAction(value: unknown): value is Action {
  if (!isPlainObject(value) || !isActionName(value.action)) return false;
  return presentKeys(value).every((key) => key === "action" || key === "payload");
}

export function isHandler(value: unknown): value is Handler {
  return isAction(value) || (Array.isArray(value) && value.length > 0 && value.every(isAction));
}

export type NodeKind = "text" | "component" | "ref" | "format" | "each" | "cond";

const DISCRIMINATORS = [
  ["component", "component"],
  ["$ref", "ref"],
  ["$format", "format"],
  ["$each", "each"],
  ["$cond", "cond"],
] as const;

/** Which node shape a value has, or null when it has none or several. */
export function nodeKind(value: unknown): NodeKind | null {
  if (typeof value === "string") return "text";
  if (!isPlainObject(value)) return null;
  let kind: NodeKind | null = null;
  for (const [key, name] of DISCRIMINATORS) {
    if (!has(value, key)) continue;
    if (kind !== null) return null;
    kind = name;
  }
  return kind;
}

export function isComponentNode(value: unknown): value is ComponentNode {
  return nodeKind(value) === "component" && isPlainObject(value) && typeof value.component === "string";
}

export function isEachNode(value: unknown): value is EachNode {
  return nodeKind(value) === "each";
}

export function isCondNode(value: unknown): value is CondNode {
  return nodeKind(value) === "cond";
}
