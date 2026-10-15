// Field paths: `a.b[0].c` (or `a.b.0.c`) addresses nested form values.
// Every path is stored in one canonical spelling, `a.b[0].c`, so a Field's
// `name`, a schema issue's path and a server error's key meet on the same string.

export type PathSegment = string | number;

const SEGMENTS = /\[(\d+)\]|[^.[\]]+/g;
const INDEX = /^\d+$/;

/** `a.b[0].c` and `a.b.0.c` → `["a", "b", 0, "c"]`. A digits-only segment is an index. */
export function parsePath(path: string): PathSegment[] {
  const out: PathSegment[] = [];
  for (const match of path.matchAll(SEGMENTS)) {
    const [whole, bracketed] = match;
    if (bracketed !== undefined) out.push(Number(bracketed));
    else out.push(INDEX.test(whole) ? Number(whole) : whole);
  }
  return out;
}

/** `["a", "b", 0, "c"]` → `a.b[0].c`. */
function formatPath(segments: readonly PathSegment[]): string {
  let out = "";
  for (const segment of segments) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out === "" ? segment : `.${segment}`;
  }
  return out;
}

/** The canonical spelling of a path. */
export function canonicalPath(path: string): string {
  return formatPath(parsePath(path));
}

/** A Standard Schema issue path (keys or `{ key }` segments) in canonical form. `""` is the form itself. */
export function issuePath(path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined): string {
  if (!path) return "";
  return formatPath(
    path.map((part) => {
      const key = typeof part === "object" && part !== null ? part.key : part;
      if (typeof key === "number") return key;
      const text = String(key);
      return INDEX.test(text) ? Number(text) : text;
    }),
  );
}

/** True when `path` is `ancestor` or lies beneath it. */
export function isWithin(path: string, ancestor: string): boolean {
  if (path === ancestor) return true;
  if (!path.startsWith(ancestor)) return false;
  const next = path[ancestor.length];
  return next === "." || next === "[";
}

export function getIn(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of parsePath(path)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  return current;
}

function cloneContainer(node: unknown, next: PathSegment): Record<PathSegment, unknown> {
  if (Array.isArray(node)) return node.slice() as unknown as Record<PathSegment, unknown>;
  if (node !== null && typeof node === "object") return { ...(node as Record<PathSegment, unknown>) };
  return (typeof next === "number" ? [] : {}) as Record<PathSegment, unknown>;
}

/**
 * A copy of `source` with `value` at `path`. Only the containers along the
 * path are copied; every untouched branch keeps its identity.
 */
export function setIn<T>(source: T, path: string, value: unknown): T {
  const segments = parsePath(path);
  if (segments.length === 0) return value as T;
  const root = cloneContainer(source, segments[0] as PathSegment);
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i] as PathSegment;
    const child = cloneContainer(cursor[key], segments[i + 1] as PathSegment);
    cursor[key] = child;
    cursor = child;
  }
  cursor[segments[segments.length - 1] as PathSegment] = value;
  return root as T;
}

/** Structural equality for form values: primitives, arrays, plain objects, dates. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.hasOwn(b, key) && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Where a key under the array at `arrayPath` goes after a structural edit.
 * `moved` maps an old row index to its new one (`-1`: the row is gone).
 * Returns the key unchanged when it is not under a moved row, `null` when its row is gone.
 */
export function remapRowKey(key: string, arrayPath: string, moved: ReadonlyMap<number, number>): string | null {
  const prefix = `${arrayPath}[`;
  if (!key.startsWith(prefix)) return key;
  const close = key.indexOf("]", prefix.length);
  if (close === -1) return key;
  const index = Number(key.slice(prefix.length, close));
  const to = moved.get(index);
  if (to === undefined) return key;
  if (to === -1) return null;
  return `${prefix}${to}${key.slice(close)}`;
}
