import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { manualFrames } from "./frames.test.helpers";
import { nextReplayLength, useReplay } from "./replay";

describe("nextReplayLength", () => {
  it("adds the rate, capped at the text", () => {
    expect(nextReplayLength("abcdefgh", 0, 3)).toBe(3);
    expect(nextReplayLength("abcdefgh", 6, 3)).toBe(8);
  });

  it("shows everything at once at rate 0", () => {
    expect(nextReplayLength("abcdefgh", 0, 0)).toBe(8);
  });

  it("never ends between the halves of a surrogate pair", () => {
    // "a😀b": the emoji is two code units at 1 and 2.
    expect(nextReplayLength("a😀b", 0, 2)).toBe(3);
    expect(nextReplayLength("a😀b", 0, 1)).toBe(1);
  });
});

describe("useReplay", () => {
  it("pushes the rate once per frame and completes with the last push", () => {
    const frames = manualFrames();
    const { result } = renderHook(() => useReplay("abcdefg", 3, frames.schedule));
    expect(result.current).toEqual({ text: "", complete: false });

    frames.next();
    expect(result.current).toEqual({ text: "abc", complete: false });
    frames.next();
    expect(result.current).toEqual({ text: "abcdef", complete: false });
    frames.next();
    expect(result.current).toEqual({ text: "abcdefg", complete: true });
    expect(frames.waiting).toBe(0);
  });

  it("pushes everything in one frame at rate 0", () => {
    const frames = manualFrames();
    const { result } = renderHook(() => useReplay("abcdefg", 0, frames.schedule));
    expect(result.current).toEqual({ text: "", complete: false });
    frames.next();
    expect(result.current).toEqual({ text: "abcdefg", complete: true });
    expect(frames.waiting).toBe(0);
  });

  it("passes the text through, complete, without a rate", () => {
    const frames = manualFrames();
    const { result } = renderHook(() => useReplay("abc", null, frames.schedule));
    expect(result.current).toEqual({ text: "abc", complete: true });
    expect(frames.waiting).toBe(0);
  });

  it("starts over from nothing when the text changes mid-replay", () => {
    const frames = manualFrames();
    const { result, rerender } = renderHook(({ text }) => useReplay(text, 2, frames.schedule), { initialProps: { text: "abcdef" } });
    frames.next();
    expect(result.current.text).toBe("ab");
    rerender({ text: "uvwxyz" });
    expect(result.current).toEqual({ text: "", complete: false });
    expect(frames.waiting).toBe(1);
    frames.next();
    expect(result.current.text).toBe("uv");
  });

  it("stops scheduling on unmount", () => {
    const frames = manualFrames();
    const { unmount } = renderHook(() => useReplay("abcdef", 2, frames.schedule));
    expect(frames.waiting).toBe(1);
    unmount();
    expect(frames.waiting).toBe(0);
  });
});
