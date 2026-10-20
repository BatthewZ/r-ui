/**
 * The `$ref` grammar: `root(.segment)*`. The root is a name (a scope root such
 * as `data`, or a local name such as an `$each` alias); a segment is any
 * non-empty run of characters other than `.`, and an array index is its
 * decimal position. Lookups read own properties only, so no path reaches a
 * prototype.
 */

import { FORBIDDEN_SEGMENTS, NAME_PATTERN } from "./types";

export interface RefPath {
  readonly root: string;
  readonly segments: readonly string[];
}

const FORBIDDEN: ReadonlySet<string> = new Set<string>(FORBIDDEN_SEGMENTS);

/** The parsed path, or null when it breaks the grammar or names a forbidden segment. */
export function parseRefPath(path: string): RefPath | null {
  if (typeof path !== "string" || path.length === 0) return null;
  const [root = "", ...segments] = path.split(".");
  if (!NAME_PATTERN.test(root) || FORBIDDEN.has(root)) return null;
  for (const segment of segments) {
    if (segment.length === 0 || FORBIDDEN.has(segment)) return null;
  }
  return { root, segments };
}

/** Walks `segments` from `value`: own properties, array positions, and `length` of an array or string. */
export function walkSegments(value: unknown, segments: readonly string[]): unknown {
  let current = value;
  for (const segment of segments) {
    if (typeof current === "string") {
      if (segment !== "length") return undefined;
      current = current.length;
      continue;
    }
    if (typeof current !== "object" || current === null) return undefined;
    if (!Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * The value at `path`, read from `scope` (an object whose own keys are the
 * roots in reach: `data`, `state`, … and the local names). Undefined when the
 * path is malformed, its root is out of reach or any step is missing.
 */
export function readRef(path: string, scope: Readonly<Record<string, unknown>>): unknown {
  const parsed = parseRefPath(path);
  if (parsed === null || !Object.hasOwn(scope, parsed.root)) return undefined;
  return walkSegments(scope[parsed.root], parsed.segments);
}
