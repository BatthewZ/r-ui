import { useCallback, useState, useSyncExternalStore } from "react";

import { createViewSpecParser, type ViewSpecParser } from "./parser";
import { EMPTY_SNAPSHOT, type StreamSnapshot } from "./snapshot";

/**
 * Chunks of a document: strings, or bytes decoded as UTF-8. A `Response` is
 * read from its body; one that is not `ok` ends at once, incomplete.
 */
export type ViewSpecSource =
  | ReadableStream<string | Uint8Array>
  | AsyncIterable<string | Uint8Array>
  | Response;

type Chunk = string | Uint8Array;

function isResponse(source: ViewSpecSource): source is Response {
  return typeof Response === "function" && source instanceof Response;
}

function isReadableStream(source: ViewSpecSource): source is ReadableStream<Chunk> {
  return "getReader" in source && typeof source.getReader === "function";
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ignore(): void {}

/** Runs `callback` on the next animation frame (a 16 ms timer where there are none); returns its cancel. */
export function requestFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const handle = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(handle);
  }
  const handle = setTimeout(callback, 16);
  return () => clearTimeout(handle);
}

/**
 * One source read once, however many components watch it: reading starts
 * with the first subscriber and is cancelled shortly after the last leaves
 * (not at once, so StrictMode's unmount-remount keeps a one-shot stream).
 */
class StreamFeed {
  private readonly parser: ViewSpecParser = createViewSpecParser();
  private readonly decoder = new TextDecoder();
  private readonly listeners = new Set<() => void>();
  private latest: StreamSnapshot = EMPTY_SNAPSHOT;
  /** What subscribers see: `latest` as of the last animation frame, or the final snapshot. */
  published: StreamSnapshot = EMPTY_SNAPSHOT;
  private started = false;
  private stopped = false;
  private cancelFrame: (() => void) | undefined;
  private cancelRead: () => void = ignore;

  constructor(private readonly source: ViewSpecSource) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (!this.started) {
      this.started = true;
      void this.read();
    }
    return () => {
      this.listeners.delete(listener);
      setTimeout(() => {
        if (this.listeners.size === 0) this.stop("The stream was abandoned.");
      }, 0);
    };
  }

  private async read(): Promise<void> {
    const source = this.source;
    try {
      if (isResponse(source)) {
        if (!source.ok) return this.stop(`The response failed (${source.status}).`);
        if (source.body !== null) await this.readStream(source.body);
      } else if (isReadableStream(source)) {
        await this.readStream(source);
      } else {
        const iterator = source[Symbol.asyncIterator]();
        this.cancelRead = () => {
          void iterator.return?.().then(ignore, ignore);
        };
        for (;;) {
          const step = await iterator.next();
          if (this.stopped || step.done === true) break;
          this.feed(step.value);
        }
      }
      this.stop();
    } catch (error) {
      this.stop(`The stream failed: ${reasonOf(error)}`);
    }
  }

  private async readStream(stream: ReadableStream<Chunk>): Promise<void> {
    const reader = stream.getReader();
    this.cancelRead = () => {
      reader.cancel().then(ignore, ignore);
    };
    for (;;) {
      const step = await reader.read();
      if (this.stopped || step.done) return;
      this.feed(step.value);
    }
  }

  private feed(chunk: Chunk): void {
    this.latest = this.parser.push(typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true }));
    if (this.cancelFrame === undefined && this.latest !== this.published) {
      this.cancelFrame = requestFrame(() => {
        this.cancelFrame = undefined;
        this.publish();
      });
    }
  }

  /** The end of reading, for any reason: `failure` explains an early one. */
  private stop(failure?: string): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelRead();
    if (failure === undefined) this.parser.push(this.decoder.decode());
    const ended = this.parser.end();
    this.latest =
      failure !== undefined && ended.error?.code === "stream-incomplete"
        ? withMessage(ended, `${failure} ${ended.error.message}`)
        : ended;
    this.cancelFrame?.();
    this.cancelFrame = undefined;
    this.publish();
  }

  private publish(): void {
    if (this.published === this.latest) return;
    this.published = this.latest;
    for (const listener of [...this.listeners]) listener();
  }
}

function withMessage(snapshot: StreamSnapshot, message: string): StreamSnapshot {
  const { spec, complete, pending, error } = snapshot;
  return error === undefined ? snapshot : { spec, complete, pending, error: { ...error, message } };
}

const feeds = new WeakMap<object, StreamFeed>();

function feedFor(source: ViewSpecSource): StreamFeed {
  let feed = feeds.get(source);
  if (feed === undefined) {
    feed = new StreamFeed(source);
    feeds.set(source, feed);
  }
  return feed;
}

function emptySnapshot(): StreamSnapshot {
  return EMPTY_SNAPSHOT;
}

/**
 * Reads `source` into snapshots, re-rendering at most once per animation
 * frame. A new source starts over; an abort or a read error leaves the last
 * snapshot with a `stream-incomplete` error.
 */
export function useViewSpecStream(source: ViewSpecSource | null | undefined): StreamSnapshot {
  const feed = source == null ? undefined : feedFor(source);
  const subscribe = useCallback(
    (listener: () => void) => (feed === undefined ? ignore : feed.subscribe(listener)),
    [feed],
  );
  const getSnapshot = useCallback(() => feed?.published ?? EMPTY_SNAPSHOT, [feed]);
  return useSyncExternalStore(subscribe, getSnapshot, emptySnapshot);
}

/**
 * The parser behind `useTextStream`, kept equal to the last text it was
 * given: growth pushes the new part, any other change starts over.
 */
class TextFeed {
  private readonly parser = createViewSpecParser();
  private text = "";
  private ended = false;

  update(text: string | undefined, complete: boolean): StreamSnapshot {
    if (text === undefined) return EMPTY_SNAPSHOT;
    if (text !== this.text || (this.ended && !complete)) {
      if (!this.ended && text.startsWith(this.text)) this.parser.push(text.slice(this.text.length));
      else {
        this.parser.reset();
        this.ended = false;
        this.parser.push(text);
      }
      this.text = text;
    }
    if (complete && !this.ended) {
      this.ended = true;
      this.parser.end();
    }
    return this.parser.snapshot;
  }
}

function createTextFeed(): TextFeed {
  return new TextFeed();
}

/**
 * Snapshots for a growing string (`<ViewRenderer text complete>`): when `text`
 * extends the last one only the new part is parsed; any other change starts
 * over. `complete` ends the stream. With no text (another input mode) it
 * parses nothing and returns an empty snapshot.
 */
export function useTextStream(text: string | undefined, complete: boolean): StreamSnapshot {
  // The feed is a pure function of (text, complete) whatever renders it saw, so
  // updating it during render is safe under StrictMode and discarded renders.
  const [feed] = useState(createTextFeed);
  return feed.update(text, complete);
}
