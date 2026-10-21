import { appendPointer } from "../spec/pointer";
import type { RenderContext } from "../runtime/context";

/** View-wide values `renderNode` reads that the runtime does not own. */
export interface ViewEnv {
  /** The host's locale (its LocaleProvider), for FormatSpecs; the runtime's default when absent. */
  readonly locale: string | undefined;
  /** Forms the document declares: a `Form` naming one whose handle has not mounted yet waits. */
  readonly formNames: ReadonlySet<string>;
}

export const DEFAULT_VIEW_ENV: ViewEnv = Object.freeze({
  locale: undefined,
  formNames: new Set<string>(),
});

/** Where `renderNode` is in the document, and what it can see there. */
export interface Scope {
  readonly ctx: RenderContext;
  readonly env: ViewEnv;
  /** Local names: `$each` aliases and `<as>Index`, template names (`row`, `rowIndex`, …). */
  readonly vars: { readonly [name: string]: unknown };
  /** JSON Pointer of the node: its React key path and its issue path. */
  readonly path: string;
  /** Node nesting from the root; past `LIMITS.depth` a node renders a diagnostic. */
  readonly depth: number;
}

const NO_VARS: { readonly [name: string]: unknown } = Object.freeze({});

export function createRootScope(ctx: RenderContext, env: ViewEnv = DEFAULT_VIEW_ENV): Scope {
  return { ctx, env, vars: NO_VARS, path: "/root", depth: 0 };
}

/** The scope one node down, at `tokens` under the current path, with `vars` added. */
export function childScope(
  scope: Scope,
  tokens: readonly (string | number)[],
  vars?: { readonly [name: string]: unknown },
): Scope {
  return propNodeScope(scope, tokens.reduce<string>(appendPointer, scope.path), vars);
}

/** A node held in a prop (`$node`, a row template) at `path`, one level down. */
export function propNodeScope(scope: Scope, path: string, vars?: { readonly [name: string]: unknown }): Scope {
  return {
    ctx: scope.ctx,
    env: scope.env,
    vars: vars ? { ...scope.vars, ...vars } : scope.vars,
    path,
    depth: scope.depth + 1,
  };
}

const refScopes = new WeakMap<object, { readonly roots: object; readonly scope: Readonly<Record<string, unknown>> }>();

/**
 * What a `$ref` reaches from `scope`: the local names, then the roots (a root
 * name always means the root). Cached per vars object and roots.
 */
export function refScopeOf(scope: Scope): Readonly<Record<string, unknown>> {
  const { roots } = scope.ctx;
  const cached = refScopes.get(scope.vars);
  if (cached !== undefined && cached.roots === roots) return cached.scope;
  const built: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const name of Object.keys(scope.vars)) built[name] = scope.vars[name];
  built.data = roots.data;
  built.status = roots.status;
  built.state = roots.state;
  built.forms = roots.forms;
  refScopes.set(scope.vars, { roots, scope: built });
  return built;
}
