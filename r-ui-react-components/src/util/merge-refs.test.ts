import { describe, expect, it, vi } from "vitest";

import { mergeRefs } from "./merge-refs";

describe("mergeRefs", () => {
  it("calls callback ref with element", () => {
    const callbackRef = vi.fn();
    const merged = mergeRefs(callbackRef);
    const node = document.createElement("div");

    merged(node);

    expect(callbackRef).toHaveBeenCalledTimes(1);
    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it("sets .current on ref object", () => {
    const refObject: { current: HTMLDivElement | null } = { current: null };
    const merged = mergeRefs(refObject);
    const node = document.createElement("div");

    merged(node);

    expect(refObject.current).toBe(node);
  });

  it("merges multiple refs (callback + object)", () => {
    const callbackRef = vi.fn();
    const refObject = { current: null };
    const merged = mergeRefs(callbackRef, refObject);
    const node = document.createElement("div");

    merged(node);

    expect(callbackRef).toHaveBeenCalledTimes(1);
    expect(callbackRef).toHaveBeenCalledWith(node);
    expect(refObject.current).toBe(node);
  });

  it("handles null refs gracefully", () => {
    const callbackRef = vi.fn();
    const merged = mergeRefs(null, callbackRef);
    const node = document.createElement("div");

    merged(node);

    expect(callbackRef).toHaveBeenCalledTimes(1);
    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it("handles undefined refs gracefully", () => {
    const callbackRef = vi.fn();
    const merged = mergeRefs(undefined, callbackRef);
    const node = document.createElement("div");

    merged(node);

    expect(callbackRef).toHaveBeenCalledTimes(1);
    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it("calls callback with null on cleanup", () => {
    const callbackRef = vi.fn();
    const refObject = { current: null as HTMLDivElement | null };
    const merged = mergeRefs(callbackRef, refObject);

    merged(null);

    expect(callbackRef).toHaveBeenCalledTimes(1);
    expect(callbackRef).toHaveBeenCalledWith(null);
    expect(refObject.current).toBeNull();
  });

  // A merged setter is re-entrant: React attaches then detaches through the same
  // closure, and each pass must visit every ref exactly once.
  it("invokes each ref exactly once per call across attach and detach", () => {
    const callbackRef = vi.fn();
    const refObject = { current: null as HTMLDivElement | null };
    const merged = mergeRefs(callbackRef, refObject);
    const node = document.createElement("div");

    merged(node);
    expect(refObject.current).toBe(node);

    merged(null);

    expect(callbackRef).toHaveBeenCalledTimes(2);
    expect(callbackRef).toHaveBeenNthCalledWith(1, node);
    expect(callbackRef).toHaveBeenNthCalledWith(2, null);
    expect(refObject.current).toBeNull();
  });
});
