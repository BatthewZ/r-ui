import type { IssueCode } from "../spec/types";

/** The document as far as it has arrived: the top-level object, possibly partial. */
export type PartialDocument = { readonly [key: string]: unknown };

export interface StreamError {
  /** `too-deep`: arrays and objects nest past `LIMITS.jsonDepth`. */
  readonly code: Extract<IssueCode, "invalid-json" | "too-deep" | "stream-incomplete">;
  readonly message: string;
  /** Characters into the (fence-stripped) text where it went wrong. */
  readonly offset: number;
}

/**
 * One view of a streaming document. Closed values are final JSON and keep
 * their identity from one snapshot to the next (render memoises on it). An
 * open object or array holds its closed members and its open last member; an
 * open string is `PENDING`, except a text child (an element of a node's
 * `children`), which is its partial text; an open number or literal is
 * `PENDING`; a key whose value has not started is absent.
 */
export interface StreamSnapshot {
  /** Undefined until the top-level `{` arrives. */
  readonly spec: PartialDocument | undefined;
  /** The top-level value has closed. */
  readonly complete: boolean;
  /** JSON Pointers of every value still open (`""` while the document is). */
  readonly pending: ReadonlySet<string>;
  /** Malformed or too deeply nested text, or `end()` before the document closed. The last good `spec` stays. */
  readonly error?: StreamError;
}

export const NOTHING_PENDING: ReadonlySet<string> = new Set();

/** Before the document's `{` has arrived, and for no input at all. */
export const EMPTY_SNAPSHOT: StreamSnapshot = Object.freeze({ spec: undefined, complete: false, pending: NOTHING_PENDING });

/** The document a snapshot belongs to: one per parser run (a new parser, or a `reset`). */
export type StreamRun = object;

const RUNS = new WeakMap<StreamSnapshot, StreamRun>();

/** Marks `snapshot` as a view of `run`'s document. */
export function stampRun<T extends StreamSnapshot>(snapshot: T, run: StreamRun): T {
  RUNS.set(snapshot, run);
  return snapshot;
}

/**
 * The run `snapshot` came from; undefined for one no parser made (the empty
 * snapshot, or one a host built), which belongs to no document in particular.
 */
export function runOf(snapshot: StreamSnapshot): StreamRun | undefined {
  return RUNS.get(snapshot);
}
