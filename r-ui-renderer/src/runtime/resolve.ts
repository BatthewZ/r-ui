import { isConcatMarker, isForbiddenSegment, isFormatMarker, isNodeMarker, isPlainObject, isRefMarker } from "../spec/guards";
import { readRef } from "../spec/ref-path";
import type { FormatOptions } from "../spec/types";

/** Formats a resolved value per a FormatSpec's options, in the host's locale. */
export type FormatValue = (value: unknown, options: FormatOptions) => string;

/** Names a `$ref` can reach: the roots, the local names and, in a handler, `event`. */
export type RefScope = Readonly<Record<string, unknown>>;

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
 * `value` with every `$ref`, `$format` and `$concat` resolved, at any depth. What a
 * `$ref` reaches is data and is not resolved again; a `$node` means nothing
 * outside props and resolves to nothing.
 */
export function resolveValue(value: unknown, scope: RefScope, format: FormatValue): unknown {
  if (isRefMarker(value)) return readRef(value.$ref, scope);
  if (isFormatMarker(value)) {
    const { value: inner, ...options } = value.$format;
    return format(resolveValue(inner, scope, format), options as FormatOptions);
  }
  if (isConcatMarker(value)) return joinParts(value.$concat.map((part: unknown) => resolveValue(part, scope, format)));
  if (isNodeMarker(value)) return undefined;
  if (Array.isArray(value)) return value.map((item: unknown) => resolveValue(item, scope, format));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (!isForbiddenSegment(key)) out[key] = resolveValue(value[key], scope, format);
    }
    return out;
  }
  return value;
}
