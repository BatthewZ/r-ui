import { isFormatMarker, isNodeMarker, isPlainObject, isRefMarker } from "../spec/guards";
import { readRef } from "../spec/ref-path";
import { FORBIDDEN_SEGMENTS, type FormatOptions } from "../spec/types";

/** Formats a resolved value per a FormatSpec's options, in the host's locale. */
export type FormatValue = (value: unknown, options: FormatOptions) => string;

/** Names a `$ref` can reach: the roots, the local names and, in a handler, `event`. */
export type RefScope = Readonly<Record<string, unknown>>;

const FORBIDDEN: ReadonlySet<string> = new Set<string>(FORBIDDEN_SEGMENTS);

/** Without a host formatter: the value as text, or the spec's `missing` text. */
export const plainFormat: FormatValue = (value, options) =>
  value === null || value === undefined ? (options.missing ?? "—") : String(value);

/**
 * `value` with every `$ref` and `$format` resolved, at any depth. What a
 * `$ref` reaches is data and is not resolved again; a `$node` means nothing
 * outside props and resolves to nothing.
 */
export function resolveValue(value: unknown, scope: RefScope, format: FormatValue): unknown {
  if (isRefMarker(value)) return readRef(value.$ref, scope);
  if (isFormatMarker(value)) {
    const { value: inner, ...options } = value.$format;
    return format(resolveValue(inner, scope, format), options as FormatOptions);
  }
  if (isNodeMarker(value)) return undefined;
  if (Array.isArray(value)) return value.map((item: unknown) => resolveValue(item, scope, format));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (!FORBIDDEN.has(key)) out[key] = resolveValue(value[key], scope, format);
    }
    return out;
  }
  return value;
}
