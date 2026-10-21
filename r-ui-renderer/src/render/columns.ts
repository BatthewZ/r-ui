/**
 * DataTable (and VirtualizedTable) columns: the document's declarative
 * column specs as the library's column objects. Runs on the literal specs,
 * before marker resolution, so a `cell` template becomes the function the
 * table calls rather than one element.
 */

import { isNodeMarker, isPlainObject, isRefMarker } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { accessor, cellValue, fieldSegments } from "./coerce";
import { createFormatter } from "./format";
import type { PropResolver } from "./resolve";
import { type TemplateSources, templateFunction } from "./templates";

const CELL_NAMES = ["row", "rowIndex", "value"] as const;

/** Column keys passed on as they resolve. */
const SCALAR_KEYS: ReadonlySet<string> = new Set([
  "label",
  "numeric",
  "sortable",
  "firstDirection",
  "priority",
  "truncate",
  "required",
  "resizable",
]);

const LENGTH_KEYS: ReadonlySet<string> = new Set(["width", "minWidth", "maxWidth"]);

/** Keys the renderer builds the library's column from, not passing them on: it has no `field` or `format`. */
export const BRIDGED_COLUMN_KEYS = ["field", "format"] as const;

/** Every column key this module reads; any other is dropped as unknown. */
export const COLUMN_KEYS: readonly string[] = ["id", "header", "cell", "filter", ...BRIDGED_COLUMN_KEYS, ...SCALAR_KEYS, ...LENGTH_KEYS];

/** A CSS length, a keyword width or a `calc()` of them; it lands in a custom property read as a width. */
const CSS_LENGTH = /^(?:-?(?:\d+|\d*\.\d+)(?:px|rem|em|ch|ex|lh|%|vw|vh|cqi|cqw)?|auto|min-content|max-content|fit-content|calc\([\w\s.+\-*/(),%]*\))$/;

function isCssLength(value: unknown): value is string {
  return typeof value === "string" && CSS_LENGTH.test(value) && !/url\(/i.test(value);
}

export interface ColumnOptions {
  /** The names a `cell` template sees (the contract's `columns[].cell`). */
  readonly cellNames: readonly string[] | undefined;
  /** Each row's position in the table's rows. */
  readonly rowIndex: TemplateSources["rowIndex"];
}

function filterOf(resolver: PropResolver, value: unknown, path: string): unknown {
  if (!isPlainObject(value)) return resolver.drop("invalid-prop-value", path, "A column filter is an object.");
  const placeholder = typeof value.placeholder === "string" ? value.placeholder : undefined;
  if (value.type === "text") return placeholder === undefined ? { type: "text" } : { type: "text", placeholder };
  if (value.type === "select" && Array.isArray(value.options)) {
    const options = value.options.filter(
      (option: unknown) => isPlainObject(option) && typeof option.value === "string" && typeof option.label === "string",
    );
    return { type: "select", options: options.map((option) => ({ value: option.value, label: option.label })) };
  }
  return resolver.drop("invalid-prop-value", path, 'A column filter is { "type": "text" } or { "type": "select", "options": [...] }.');
}

function column(resolver: PropResolver, spec: unknown, path: string, literal: boolean, options: ColumnOptions): unknown {
  if (!isPlainObject(spec)) return resolver.drop("invalid-prop-value", path, "A column is an object with an `id`.");
  const id = resolver.resolve(spec.id, appendPointer(path, "id"));
  if (typeof id !== "string" || id.length === 0) return resolver.drop("invalid-prop-value", path, "A column needs a text `id`.");
  const out: Record<string, unknown> = { id, header: id };
  let segments: readonly string[] = [id];
  let format: ((value: unknown) => string) | null = null;
  let cellTemplate: unknown;

  for (const key of Object.keys(spec)) {
    const keyPath = appendPointer(path, key);
    const raw = spec[key];
    if (key === "id") continue;
    if (key === "cell") {
      if (literal && isNodeMarker(raw)) cellTemplate = raw.$node;
      else resolver.drop("invalid-prop-value", keyPath, 'A column `cell` is a row template: { "$node": … }.');
      continue;
    }
    const value = literal ? resolver.resolve(raw, keyPath) : raw;
    if (value === undefined) continue;
    if (key === "header") out.header = value;
    else if (key === "field") {
      const parsed = fieldSegments(value);
      if (parsed === null) resolver.drop("invalid-prop-value", keyPath, "`field` is a dot path into the row.");
      else segments = parsed;
    } else if (key === "format") {
      format = createFormatter(value, resolver.scope.env.locale);
      if (format === null) resolver.drop("invalid-prop-value", keyPath, "`format` is a FormatSpec: a style, or { style, … }.");
    } else if (key === "filter") {
      const filter = filterOf(resolver, value, keyPath);
      if (isPlainObject(filter)) out.filter = filter;
    } else if (LENGTH_KEYS.has(key)) {
      if (isCssLength(value)) out[key] = value;
      else resolver.drop("invalid-prop-value", keyPath, `\`${key}\` is a CSS length or calc().`);
    } else if (SCALAR_KEYS.has(key)) out[key] = value;
    else resolver.drop("unknown-prop", keyPath, `Columns take no \`${key}\`.`);
  }

  const read = accessor(segments);
  const value = (row: unknown) => cellValue(read(row));
  out.value = value;
  if (cellTemplate !== undefined) {
    out.cell = templateFunction(
      cellTemplate,
      options.cellNames ?? CELL_NAMES,
      resolver.scope,
      appendPointer(path, "cell"),
      resolver.render,
      { rowIndex: options.rowIndex, value },
    );
  } else if (format !== null) {
    const shown = format;
    out.cell = (row: unknown) => shown(value(row));
    out.title = (row: unknown) => shown(value(row));
  }
  return out;
}

/** The library's columns for `raw` (an array of specs, or a `$ref` to one, whose cells are then data). */
export function coerceColumns(resolver: PropResolver, raw: unknown, path: string, options: ColumnOptions): unknown {
  const literal = !isRefMarker(raw);
  const specs = literal ? raw : resolver.resolve(raw, path);
  if (!Array.isArray(specs)) return resolver.drop("invalid-prop-value", path, "`columns` is an array of column specs.");
  const columns: unknown[] = [];
  specs.forEach((spec: unknown, index) => {
    const built = column(resolver, spec, appendPointer(path, index), literal, options);
    if (isPlainObject(built)) columns.push(built);
  });
  return columns;
}
