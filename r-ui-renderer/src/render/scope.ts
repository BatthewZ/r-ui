import { appendPointer } from "../spec/pointer";
import type { RenderContext } from "../runtime/context";

/** Where `renderNode` is in the document, and what it can see there. */
export interface Scope {
  readonly ctx: RenderContext;
  /** Local names: `$each` aliases and `<as>Index`, template names (`row`, `rowIndex`, …). */
  readonly vars: { readonly [name: string]: unknown };
  /** JSON Pointer of the node: its React key path and its issue path. */
  readonly path: string;
  /** Node nesting from the root; past `LIMITS.depth` a node renders a diagnostic. */
  readonly depth: number;
}

export function createRootScope(ctx: RenderContext): Scope {
  return { ctx, vars: {}, path: "/root", depth: 0 };
}

/** The scope one node down, at `tokens` under the current path, with `vars` added. */
export function childScope(
  scope: Scope,
  tokens: readonly (string | number)[],
  vars?: { readonly [name: string]: unknown },
): Scope {
  return {
    ctx: scope.ctx,
    vars: vars ? { ...scope.vars, ...vars } : scope.vars,
    path: tokens.reduce<string>(appendPointer, scope.path),
    depth: scope.depth + 1,
  };
}
