import type { StreamSnapshot } from "./snapshot";

/** Chunks of a document: strings, or bytes decoded as UTF-8. */
export type ViewSpecSource = ReadableStream<string | Uint8Array> | AsyncIterable<string | Uint8Array>;

/**
 * Reads `source` into snapshots, re-rendering at most once per animation
 * frame. A new source starts over; an abort or a read error leaves the last
 * snapshot with a `stream-incomplete` error.
 */
export function useViewSpecStream(source: ViewSpecSource | null | undefined): StreamSnapshot {
  throw new Error("not implemented");
}

/**
 * Snapshots for a growing string (`<ViewRenderer text complete>`): when `text`
 * extends the last one only the new part is parsed; any other change starts
 * over. `complete` ends the stream. With no text (another input mode) it
 * parses nothing and returns an empty snapshot.
 */
export function useTextStream(text: string | undefined, complete: boolean): StreamSnapshot {
  throw new Error("not implemented");
}
