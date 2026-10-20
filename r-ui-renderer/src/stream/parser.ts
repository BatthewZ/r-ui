import type { StreamSnapshot } from "./snapshot";

/**
 * A stateful, incremental ViewSpec parser. `push` takes the next chunk and
 * returns the new snapshot; closed subtrees keep their identity across
 * snapshots. A leading Markdown fence (```json) and a closing one are skipped.
 */
export interface ViewSpecParser {
  push(chunk: string): StreamSnapshot;
  /** No more text: an open document becomes a `stream-incomplete` error. */
  end(): StreamSnapshot;
  /** Back to an empty document, for text that changed rather than grew. */
  reset(): void;
  readonly snapshot: StreamSnapshot;
}

export function createViewSpecParser(): ViewSpecParser {
  throw new Error("not implemented");
}

/** The snapshot for `text` as a prefix of a document (no `end()`). */
export function parsePartialViewSpec(text: string): StreamSnapshot {
  throw new Error("not implemented");
}
