import { render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { manualFrames } from "./frames.test.helpers";
import { createRequestTracker, QUIET_FRAMES, usePageMarkers, useSettled } from "./settle";

function deferred() {
  let resolve: () => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("createRequestTracker", () => {
  it("counts work until it settles, either way", async () => {
    const tracker = createRequestTracker();
    const ok = deferred();
    const failed = deferred();
    const first = tracker.track(ok.promise);
    const second = tracker.track(failed.promise);
    expect(tracker.pending).toBe(2);
    ok.resolve();
    await first;
    expect(tracker.pending).toBe(1);
    failed.reject(new Error("offline"));
    await expect(second).rejects.toThrow("offline");
    expect(tracker.pending).toBe(0);
  });
});

describe("useSettled", () => {
  it("waits for the document to complete", () => {
    const frames = manualFrames();
    const tracker = createRequestTracker();
    const { result, rerender } = renderHook(({ complete }) => useSettled(complete, tracker, frames.schedule), {
      initialProps: { complete: false },
    });
    expect(frames.waiting).toBe(0);
    rerender({ complete: true });
    for (let frame = 0; frame < QUIET_FRAMES; frame += 1) {
      expect(result.current).toBe(false);
      frames.next();
    }
    expect(result.current).toBe(true);
  });

  it("restarts the quiet count whenever a request is in flight", async () => {
    const frames = manualFrames();
    const tracker = createRequestTracker();
    const request = deferred();
    const tracked = tracker.track(request.promise);
    const { result } = renderHook(() => useSettled(true, tracker, frames.schedule));

    frames.next();
    frames.next();
    frames.next();
    expect(result.current).toBe(false);

    request.resolve();
    await tracked;
    frames.next();
    expect(result.current).toBe(false);
    frames.next();
    expect(result.current).toBe(true);
    expect(frames.waiting).toBe(0);
  });
});

describe("usePageMarkers", () => {
  function Markers({ ready, error }: { ready: boolean; error?: string }) {
    usePageMarkers(ready, error);
    return null;
  }
  const root = document.documentElement;

  it("marks <html> ready while ready, and clears it on unmount", () => {
    const { rerender, unmount } = render(<Markers ready={false} />);
    expect(root.hasAttribute("data-renderer-ready")).toBe(false);
    rerender(<Markers ready />);
    expect(root.getAttribute("data-renderer-ready")).toBe("");
    expect(root.hasAttribute("data-renderer-error")).toBe(false);
    unmount();
    expect(root.hasAttribute("data-renderer-ready")).toBe(false);
  });

  it("names a route error beside ready", () => {
    const { unmount } = render(<Markers ready error="unknown-view" />);
    expect(root.getAttribute("data-renderer-ready")).toBe("");
    expect(root.getAttribute("data-renderer-error")).toBe("unknown-view");
    unmount();
    expect(root.hasAttribute("data-renderer-error")).toBe(false);
  });
});
