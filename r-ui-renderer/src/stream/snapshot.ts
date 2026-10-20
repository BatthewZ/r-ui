import type { IssueCode } from "../spec/types";

/** The document as far as it has arrived: the top-level object, possibly partial. */
export type PartialDocument = { readonly [key: string]: unknown };

export interface StreamError {
  readonly code: Extract<IssueCode, "invalid-json" | "stream-incomplete">;
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
  /** Malformed text, or `end()` before the document closed. The last good `spec` stays. */
  readonly error?: StreamError;
}
