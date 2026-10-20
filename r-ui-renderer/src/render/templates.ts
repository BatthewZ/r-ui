import type { ReactNode } from "react";

import type { Slot } from "./memo";
import { propNodeScope, type Scope } from "./scope";

export type RenderAt = (node: unknown, scope: Scope, slot: Slot) => ReactNode;

/** Values a template's names take that the component's arguments do not carry directly. */
export interface TemplateSources {
  /** The row's position in the rows the document gave. */
  readonly rowIndex?: (row: unknown) => number | undefined;
  /** The cell's value (a column's `field`). */
  readonly value?: (row: unknown) => unknown;
}

const TEMPLATE_SLOT: Slot = { boundary: true, structural: false };

function jsonish(value: unknown): unknown {
  return value instanceof Set ? [...(value as Set<unknown>)] : value;
}

function nameValue(name: string, index: number, args: readonly unknown[], sources: TemplateSources): unknown {
  switch (name) {
    case "row":
      return args[0];
    case "rowIndex":
      return sources.rowIndex?.(args[0]) ?? (typeof args[1] === "number" ? args[1] : undefined);
    case "value":
      return sources.value?.(args[0]);
    default:
      // `selectedKeys` and a host's own names: the arguments in order, Sets as arrays.
      return jsonish(args[index]);
  }
}

/**
 * A row template (`{ "$node": … }` where a component wants a function) as
 * that function: each call renders the template with `names` bound to what
 * the component passed.
 */
export function templateFunction(
  template: unknown,
  names: readonly string[],
  scope: Scope,
  path: string,
  render: RenderAt,
  sources: TemplateSources = {},
): (...args: unknown[]) => ReactNode {
  return (...args: unknown[]) => {
    const vars: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    names.forEach((name, index) => {
      vars[name] = nameValue(name, index, args, sources);
    });
    return render(template, propNodeScope(scope, `${path}/$node`, vars), TEMPLATE_SLOT);
  };
}

/** Each row's position in `rows`, found by identity (and computed once per rows array). */
export function rowIndexLookup(getRows: () => unknown): (row: unknown) => number | undefined {
  let indexed: unknown;
  let positions = new Map<unknown, number>();
  return (row) => {
    const rows = getRows();
    if (!Array.isArray(rows)) return undefined;
    if (rows !== indexed) {
      indexed = rows;
      positions = new Map();
      rows.forEach((item: unknown, index) => {
        if (!positions.has(item)) positions.set(item, index);
      });
    }
    return positions.get(row);
  };
}
