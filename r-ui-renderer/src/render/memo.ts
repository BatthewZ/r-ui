/**
 * Rendering memoised by node object identity. A streaming snapshot keeps the
 * identity of every closed subtree, so a node already drawn returns the very
 * element it returned before and React skips it. An entry is reused only when
 * everything the render read is the same: the context (field by field, the
 * stream's pending set aside), the view env, the local names, the position
 * and whether the node itself is still streaming.
 */

import type { ReactNode } from "react";

import type { RenderContext } from "../runtime/context";
import { sameEntries } from "../spec/equal";
import type { Scope } from "./scope";

export interface Slot {
  /** The parent does not read its children: a boundary may wrap this node's element. */
  readonly boundary: boolean;
  /** No element may stand here (table structure): a diagnostic goes to the issue log. */
  readonly structural: boolean;
  /** React key for the outermost element (an `$each` item). */
  readonly key?: string;
}

interface Entry {
  readonly ctx: RenderContext;
  readonly env: Scope["env"];
  readonly vars: Scope["vars"];
  readonly path: string;
  readonly boundary: boolean;
  readonly structural: boolean;
  readonly key: string | undefined;
  readonly pending: boolean;
  readonly result: ReactNode;
}

/** Entries kept per node: two views showing the same document object do not evict each other. */
const ENTRIES_PER_NODE = 4;

const cache = new WeakMap<object, Entry[]>();

/** The same items in the same order, by identity. */
export function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
}

/** The same context for rendering: every field identical (roots and lists compared one level down). */
function sameContext(a: RenderContext, b: RenderContext): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof RenderContext)[];
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    const x: unknown = a[key];
    const y: unknown = b[key];
    if (Object.is(x, y)) continue;
    if (key === "streaming") {
      if (a.streaming.complete !== b.streaming.complete || a.streaming.fallback !== b.streaming.fallback) return false;
      continue;
    }
    if (Array.isArray(x) && Array.isArray(y) && sameList(x, y)) continue;
    if (key === "roots" && sameEntries(a.roots, b.roots)) continue;
    return false;
  }
  return true;
}

function matches(entry: Entry, scope: Scope, slot: Slot, pending: boolean): boolean {
  return (
    entry.path === scope.path &&
    entry.vars === scope.vars &&
    entry.env === scope.env &&
    entry.boundary === slot.boundary &&
    entry.structural === slot.structural &&
    entry.key === slot.key &&
    entry.pending === pending &&
    sameContext(entry.ctx, scope.ctx)
  );
}

/** `render()` for `node` at `scope`, or what it returned last time for the same inputs. */
export function memoised(node: object, scope: Scope, slot: Slot, render: () => ReactNode): ReactNode {
  const pending = !scope.ctx.streaming.complete && scope.ctx.streaming.pending.has(scope.path);
  const entries = cache.get(node);
  const hit = entries?.find((entry) => matches(entry, scope, slot, pending));
  if (hit !== undefined) return hit.result;
  const result = render();
  const entry: Entry = {
    ctx: scope.ctx,
    env: scope.env,
    vars: scope.vars,
    path: scope.path,
    boundary: slot.boundary,
    structural: slot.structural,
    key: slot.key,
    pending,
    result,
  };
  const next = [entry, ...(entries ?? [])].slice(0, ENTRIES_PER_NODE);
  cache.set(node, next);
  return result;
}
