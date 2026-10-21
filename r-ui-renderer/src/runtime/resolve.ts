import { toFormatOptions } from "../render/format";
import { isConcatMarker, isForbiddenSegment, isFormatMarker, isNodeMarker, isPlainObject, isRefMarker } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { LIMITS } from "../spec/policy";
import { DROP, setOwn } from "../spec/prop-path";
import { readRef } from "../spec/ref-path";
import type { FormatMarker, FormatOptions, IssueCode } from "../spec/types";
import { isPending } from "../stream/pending";

/** Formats a resolved value per a FormatSpec's options, in the host's locale. */
export type FormatValue = (value: unknown, options: FormatOptions) => string;

/** Names a `$ref` can reach: the roots, the local names and, in a handler, `event`. */
export type RefScope = Readonly<Record<string, unknown>>;

/** The value at a `$ref` path, never `PENDING` (a value still streaming reads as missing). */
export function readValue(path: string, scope: RefScope): unknown {
  const value = readRef(path, scope);
  return isPending(value) ? undefined : value;
}

/** A resolved value as text where text renders: a string or a finite number; anything else is no text. */
export function valueText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * A `$concat` marker's resolved parts joined into one string, or undefined
 * (the value is missing) when a part is not a string, finite number or boolean.
 */
export function joinParts(parts: readonly unknown[]): string | undefined {
  let text = "";
  for (const part of parts) {
    if (typeof part === "boolean") text += String(part);
    else {
      const piece = valueText(part);
      if (piece === null) return undefined;
      text += piece;
    }
  }
  return text;
}

/** Without a host formatter: the value as text, or the spec's `missing` text. */
export const plainFormat: FormatValue = (value, options) =>
  value === null || value === undefined ? (options.missing ?? "—") : String(value);

/**
 * The one walk over a value's markers, shared by props (render's
 * `PropResolver`), action payloads and data-binding params (`resolveValue`).
 * Both agree that a `$ref` reads data that is never resolved again (a value
 * still streaming reads as missing); `$concat` joins its resolved parts;
 * `$format` formats its resolved value, and one with no style shows the value
 * as plain text; a key that reaches a prototype is dropped; nesting past
 * `LIMITS.depth` resolves to nothing; and a literal with nothing to resolve
 * keeps its identity. What differs is a subclass's: what a `$node` becomes,
 * how an object entry resolves (a prop's `on…` key is a handler) and whether
 * a drop is reported. Here a `$node` is nothing (a payload carries data, not
 * elements) and drops are silent (an action reports what it fails on).
 */
export class MarkerResolver {
  constructor(
    private readonly refs: () => RefScope,
    private readonly formatter: FormatValue,
  ) {}

  /** A value left out at `path`, with why. */
  drop(_code: IssueCode, _path: string, _message: string): typeof DROP {
    return DROP;
  }

  /** `value` resolved at `path` (a JSON Pointer), `depth` levels in. */
  resolve(value: unknown, path: string, depth = 0): unknown {
    if (depth > LIMITS.depth) {
      this.drop("limit-exceeded", path, `Values nest deeper than ${LIMITS.depth} levels; the rest is dropped.`);
      return undefined;
    }
    if (isRefMarker(value)) return readValue(value.$ref, this.refs());
    if (isFormatMarker(value)) return this.format(value, path, depth);
    if (isConcatMarker(value)) {
      const partsPath = appendPointer(path, "$concat");
      return joinParts(value.$concat.map((part: unknown, index) => this.resolve(part, appendPointer(partsPath, index), depth + 1)));
    }
    if (isNodeMarker(value)) return this.node(value.$node, appendPointer(path, "$node"));
    if (Array.isArray(value)) {
      let changed = false;
      const out = value.map((item: unknown, index) => {
        const next = this.resolve(item, appendPointer(path, index), depth + 1);
        if (next !== item) changed = true;
        return next;
      });
      return changed ? out : value;
    }
    if (!isPlainObject(value)) return value;
    let copy: Record<string, unknown> | undefined;
    for (const key of Object.keys(value)) {
      const item = value[key];
      const keyPath = appendPointer(path, key);
      const next = isForbiddenSegment(key)
        ? this.drop("forbidden-prop", keyPath, `\`${key}\` is never passed on.`)
        : this.entry(key, item, keyPath, depth);
      if (next === item) continue;
      copy ??= { ...value };
      if (next === DROP) delete copy[key];
      else setOwn(copy, key, next);
    }
    return copy ?? value;
  }

  /** A `$format` marker's text. */
  format(marker: FormatMarker, path: string, depth = 0): string {
    const markerPath = appendPointer(path, "$format");
    const { value, ...spec } = marker.$format;
    const resolved = this.resolve(value, appendPointer(markerPath, "value"), depth + 1);
    const options = toFormatOptions(spec);
    if (options === null) {
      this.drop("invalid-prop-value", markerPath, "A `$format` needs a `style`; the value shows unformatted.");
      return valueText(resolved) ?? "";
    }
    return this.formatter(resolved, options);
  }

  /** What a `$node` (at `path`) resolves to. */
  protected node(_node: unknown, _path: string): unknown {
    return undefined;
  }

  /** An object entry's value, or DROP. */
  protected entry(_key: string, item: unknown, path: string, depth: number): unknown {
    return this.resolve(item, path, depth + 1);
  }
}

/** `value` with every marker resolved, silently, as an action payload or a data binding's params read it. */
export function resolveValue(value: unknown, scope: RefScope, format: FormatValue): unknown {
  return new MarkerResolver(() => scope, format).resolve(value, "");
}
