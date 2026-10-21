import { act, render, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { parsePartialViewSpec } from "./parser";
import { PENDING } from "./pending";
import { runOf, type StreamSnapshot } from "./snapshot";
import { TextFeed, useTextStream, useViewSpecStream, type ViewSpecSource } from "./use-view-spec-stream";

const DOCUMENT = {
  version: 2,
  title: "Streaming \u{1F680}",
  state: { tab: "a", rows: [1, 2, 3] },
  root: { component: "Stack", props: { gap: "md" }, children: ["Hello ", { component: "Badge", children: ["new"] }] },
};
const TEXT = JSON.stringify(DOCUMENT);

function chunksOf(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += size) chunks.push(text.slice(start, start + size));
  return chunks;
}

/** One chunk per read; then closes, errors (`error`), or stays open (`cancel`). */
function streamOf<T>(chunks: readonly T[], options: { error?: Error; cancel?: () => void } = {}): ReadableStream<T> {
  const queue = [...chunks];
  return new ReadableStream<T>({
    pull(controller) {
      const chunk = queue.shift();
      if (chunk !== undefined) controller.enqueue(chunk);
      else if (options.error !== undefined) controller.error(options.error);
      else if (options.cancel === undefined) controller.close();
    },
    cancel: options.cancel,
  });
}

describe("useTextStream", () => {
  it("parses only what a growing text adds: closed values keep their identity", () => {
    const cut = TEXT.indexOf('"root"');
    const { result, rerender } = renderHook(({ text }) => useTextStream(text, false), {
      initialProps: { text: TEXT.slice(0, cut) },
    });
    const state = result.current.spec?.state;
    expect(state).toEqual(DOCUMENT.state);

    rerender({ text: TEXT.slice(0, cut + 40) });
    expect(result.current.spec?.state).toBe(state);
    expect(result.current.spec?.root).toBe(PENDING);

    rerender({ text: TEXT });
    expect(result.current.spec?.state).toBe(state);
    expect(result.current.complete).toBe(true);
    expect(result.current.spec).toEqual(DOCUMENT);
  });

  it("starts over when the text changes rather than grows", () => {
    const { result, rerender } = renderHook(({ text }) => useTextStream(text, false), { initialProps: { text: TEXT } });
    const first = result.current.spec;
    const other = JSON.stringify({ ...DOCUMENT, title: "Other" });
    rerender({ text: other });
    expect(result.current.spec).toEqual(JSON.parse(other));
    expect(result.current.spec?.state).not.toBe(first?.state);
  });

  it("ends the stream on complete: an unclosed document becomes stream-incomplete, and un-completing clears it", () => {
    const partial = TEXT.slice(0, TEXT.length - 5);
    const { result, rerender } = renderHook(({ text, complete }) => useTextStream(text, complete), {
      initialProps: { text: partial, complete: true },
    });
    expect(result.current.error?.code).toBe("stream-incomplete");
    expect(result.current.spec?.state).toEqual(DOCUMENT.state);

    rerender({ text: partial, complete: false });
    expect(result.current.error).toBeUndefined();
    rerender({ text: TEXT, complete: true });
    expect(result.current.error).toBeUndefined();
    expect(result.current.complete).toBe(true);
  });

  it("parses nothing without text", () => {
    const { result } = renderHook(() => useTextStream(undefined, true));
    expect(result.current).toEqual({ spec: undefined, complete: false, pending: new Set() });
  });
});

describe("TextFeed", () => {
  /** A document of about `size` characters, many small closed members. */
  function documentOf(size: number): string {
    const rows = Array.from({ length: Math.ceil(size / 24) }, (_, index) => ({ id: index, ok: true }));
    return JSON.stringify({ version: 2, title: "Rows", data: { rows: { type: "static", value: rows } }, root: { component: "Text", children: ["x"] } });
  }

  function feedByCharacter(text: string): number {
    const feed = new TextFeed();
    const started = performance.now();
    for (let end = 1; end <= text.length; end += 1) feed.update(text.slice(0, end), false);
    expect(feed.update(text, true).complete).toBe(true);
    return performance.now() - started;
  }

  it("costs each update the characters it adds, not the whole text again", () => {
    const small = documentOf(50_000);
    const large = documentOf(200_000);
    const best = (text: string) => Math.min(feedByCharacter(text), feedByCharacter(text));
    // Four times the text a character at a time: linear work about 4x, re-reading the whole text per update about 16x.
    expect(best(large) / best(small)).toBeLessThan(8);
  }, 60_000);

  it("catches an edit the cheap growth check cannot see once the text is complete", () => {
    const titled = (title: string) => JSON.stringify({ version: 2, title, description: "d".repeat(200), root: DOCUMENT.root });
    const original = titled("First title");
    const edited = titled("Other title");
    const feed = new TextFeed();
    const cut = original.indexOf('"root"');
    feed.update(original.slice(0, cut), false);
    // Same length so far and the same tail: it reads as growth.
    feed.update(edited.slice(0, cut + 10), false);
    const done = feed.update(edited, true);
    expect(done.spec).toEqual(JSON.parse(edited));
    expect(done.spec).toEqual(parsePartialViewSpec(edited).spec);
  });

  it("starts a new run on every restart, and keeps it while the text grows", () => {
    const feed = new TextFeed();
    const first = runOf(feed.update(TEXT.slice(0, 20), false));
    expect(first).toBeDefined();
    expect(runOf(feed.update(TEXT, true))).toBe(first);
    const second = runOf(feed.update(JSON.stringify({ ...DOCUMENT, title: "B" }), true));
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
  });
});

describe("useViewSpecStream", () => {
  it("reads a ReadableStream of strings to the complete document", async () => {
    const source = streamOf(chunksOf(TEXT, 7));
    const { result } = renderHook(() => useViewSpecStream(source));
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.spec).toEqual(DOCUMENT);
    expect(result.current.error).toBeUndefined();
  });

  it("decodes UTF-8 bytes split inside a character, from a Response body", async () => {
    const bytes = new TextEncoder().encode(`\`\`\`json\n${TEXT}\n\`\`\``);
    const emoji = bytes.indexOf(0xf0);
    expect(emoji).toBeGreaterThan(0);
    const body = streamOf([bytes.slice(0, emoji + 2), bytes.slice(emoji + 2)]);
    const response = new Response(body);
    const { result } = renderHook(() => useViewSpecStream(response));
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.spec?.title).toBe(DOCUMENT.title);
    expect(result.current.error).toBeUndefined();
  });

  it("refuses a failed Response without reading it", async () => {
    const response = new Response(TEXT, { status: 503 });
    const { result } = renderHook(() => useViewSpecStream(response));
    await waitFor(() => expect(result.current.error?.code).toBe("stream-incomplete"));
    expect(result.current.error?.message).toContain("503");
    expect(result.current.spec).toBeUndefined();
  });

  it("reads an async iterable, re-rendering once per frame rather than once per chunk", async () => {
    const chunks = chunksOf(TEXT, 1);
    expect(chunks.length).toBeGreaterThan(150);
    async function* produce() {
      for (const chunk of chunks) yield chunk;
    }
    const source = produce();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useViewSpecStream(source);
    });
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.spec).toEqual(DOCUMENT);
    expect(renders).toBeLessThanOrEqual(4);
  });

  it("keeps the partial document and reports stream-incomplete when the stream errors", async () => {
    const cut = TEXT.indexOf('"root"');
    const source = streamOf([TEXT.slice(0, cut)], { error: new Error("connection reset") });
    const { result } = renderHook(() => useViewSpecStream(source));
    await waitFor(() => expect(result.current.error?.code).toBe("stream-incomplete"));
    expect(result.current.error?.message).toContain("connection reset");
    expect(result.current.spec?.state).toEqual(DOCUMENT.state);
    expect(result.current.complete).toBe(false);
  });

  it("reports stream-incomplete when the stream closes early", async () => {
    const source = streamOf([TEXT.slice(0, 30)]);
    const { result } = renderHook(() => useViewSpecStream(source));
    await waitFor(() => expect(result.current.error?.code).toBe("stream-incomplete"));
    expect(result.current.spec).toEqual({ version: 2, title: PENDING });
  });

  it("starts over, empty at once, when the source changes", async () => {
    const first = streamOf([TEXT]);
    const second = streamOf([JSON.stringify({ ...DOCUMENT, title: "Second" })]);
    const { result, rerender } = renderHook(({ source }: { source: ViewSpecSource | null }) => useViewSpecStream(source), {
      initialProps: { source: first as ViewSpecSource | null },
    });
    await waitFor(() => expect(result.current.complete).toBe(true));

    const seen: StreamSnapshot[] = [];
    rerender({ source: second });
    seen.push(result.current);
    expect(seen[0]?.spec).toBeUndefined();
    await waitFor(() => expect(result.current.spec?.title).toBe("Second"));

    rerender({ source: null });
    expect(result.current).toEqual({ spec: undefined, complete: false, pending: new Set() });
  });

  it("cancels the read once nothing watches the source", async () => {
    const cancel = vi.fn();
    const source = streamOf([TEXT.slice(0, 23)], { cancel });
    const { result, unmount } = renderHook(() => useViewSpecStream(source));
    await waitFor(() => expect(result.current.spec).toEqual({ version: 2, title: PENDING }));
    expect(cancel).toHaveBeenCalledTimes(0);
    unmount();
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  });

  it("survives StrictMode's unmount and remount with a stream that can be read once", async () => {
    const cancel = vi.fn();
    const source = new ReadableStream<string>({
      pull(controller) {
        controller.enqueue(TEXT);
        controller.close();
      },
      cancel,
    });
    let latest: StreamSnapshot | undefined;
    function Probe() {
      latest = useViewSpecStream(source);
      return null;
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    await waitFor(() => expect(latest?.complete).toBe(true));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(latest?.spec).toEqual(DOCUMENT);
    expect(latest?.error).toBeUndefined();
    expect(cancel).toHaveBeenCalledTimes(0);
  });
});
