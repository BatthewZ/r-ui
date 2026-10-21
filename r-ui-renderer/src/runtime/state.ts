import { useState, useSyncExternalStore } from "react";

import { isPlainObject, ownValue } from "../spec/guards";
import { parseRefPath } from "../spec/ref-path";

type StateObject = { readonly [key: string]: unknown };

export interface SetStateOptions {
  /** Store `value` as is, even over a plain object (`apiCall`'s `into`). */
  readonly replace?: boolean;
}

export interface ViewState {
  readonly state: StateObject;
  /**
   * `path` starts with `state.`; plain objects merge shallowly, anything else
   * replaces. Takes effect at once: the next read of `getState` sees it.
   * Returns false (and changes nothing) for a path that is not `state.…`, or
   * one that indexes a list past its end (`setAtPath`).
   */
  readonly setState: (path: string, value: unknown, options?: SetStateOptions) => boolean;
  /** The latest state, for handlers (never a render-time copy). */
  readonly getState: () => StateObject;
}

const EMPTY: StateObject = Object.freeze({});

/** The `state.…` path's segments below `state`, or null when it is not one. */
export function stateSegments(path: string): readonly string[] | null {
  const parsed = parseRefPath(path);
  if (parsed === null || parsed.root !== "state" || parsed.segments.length === 0) return null;
  return parsed.segments;
}

class StateStore {
  state: StateObject = EMPTY;
  seeded = false;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): StateObject => this.state;

  setState = (path: string, value: unknown, options?: SetStateOptions): boolean => {
    const segments = stateSegments(path);
    const next = segments === null ? null : setAtPath(this.state, segments, value, options);
    if (next === null) return false;
    this.seeded = true;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
    return true;
  };
}

/**
 * The view's `state`, seeded from the document's `state` once that object has
 * closed (`seed` is undefined until then) and never re-seeded for the same view.
 */
export function useViewState(seed: unknown): ViewState {
  const [store] = useState(() => new StateStore());
  // Seeding is idempotent for one seed and never notifies: this render already reads it.
  if (!store.seeded && seed !== undefined) {
    store.seeded = true;
    if (isPlainObject(seed)) store.state = seed;
  }
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { state, setState: store.setState, getState: store.getState };
}

const INDEX = /^(0|[1-9]\d*)$/;

/** Refused: a list index past the end would make a sparse list of any length (`rows.4294967294`). */
const REFUSED: unique symbol = Symbol("refused");

function writeInto(container: unknown, segment: string, value: unknown): unknown {
  if (Array.isArray(container) && INDEX.test(segment)) {
    const index = Number(segment);
    if (index > container.length) return REFUSED;
    const next: unknown[] = container.slice();
    next[index] = value;
    return next;
  }
  const base = isPlainObject(container) ? container : {};
  return { ...base, [segment]: value };
}

function readFrom(container: unknown, segment: string): unknown {
  if (typeof container !== "object" || container === null) return undefined;
  return ownValue(container as Readonly<Record<string, unknown>>, segment);
}

/**
 * `state` with `value` written at `path` (without the `state.` root); never
 * mutates. A list takes an index up to its length (the next item); past it
 * the write is refused: null.
 */
export function setAtPath(
  state: StateObject,
  segments: readonly string[],
  value: unknown,
  options?: SetStateOptions,
): StateObject | null {
  const write = (container: unknown, index: number): unknown => {
    const segment = segments[index] as string;
    const current = readFrom(container, segment);
    if (index < segments.length - 1) {
      const inner = write(current, index + 1);
      return inner === REFUSED ? REFUSED : writeInto(container, segment, inner);
    }
    const merged = options?.replace !== true && isPlainObject(current) && isPlainObject(value) ? { ...current, ...value } : value;
    return writeInto(container, segment, merged);
  };
  if (segments.length === 0) return state;
  const next = write(state, 0);
  return next === REFUSED ? null : (next as StateObject);
}
