import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./use-media-query";

describe("useMediaQuery", () => {
  let listeners: Map<string, Set<EventListener>>;
  let matches: boolean;
  let lastQuery: string | undefined;

  beforeEach(() => {
    listeners = new Map();
    matches = false;
    lastQuery = undefined;

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => {
        lastQuery = query;
        return {
          get matches() {
            return matches;
          },
          media: query,
          addEventListener: (event: string, handler: EventListener) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(handler);
          },
          removeEventListener: (event: string, handler: EventListener) => {
            listeners.get(event)?.delete(handler);
          },
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("evaluates the supplied query and returns the match state", () => {
    matches = true;
    const { result } = renderHook(() => useMediaQuery("(width < 40rem)"));
    expect(result.current).toBe(true);
    expect(lastQuery).toBe("(width < 40rem)");
  });

  it("returns false when the query does not match", () => {
    matches = false;
    const { result } = renderHook(() => useMediaQuery("(width < 40rem)"));
    expect(result.current).toBe(false);
  });

  it("updates when the media query change fires", () => {
    matches = false;
    const { result } = renderHook(() => useMediaQuery("(width < 40rem)"));
    expect(result.current).toBe(false);

    matches = true;
    const changeListeners = listeners.get("change");
    expect(changeListeners).toBeDefined();
    expect(changeListeners!.size).toBeGreaterThan(0);

    act(() => {
      for (const handler of changeListeners!) handler(new Event("change"));
    });

    expect(result.current).toBe(true);
  });

  it("cleans up the listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(width < 40rem)"));
    const changeListeners = listeners.get("change");
    expect(changeListeners!.size).toBeGreaterThan(0);

    unmount();
    expect(changeListeners!.size).toBe(0);
  });

  it("returns false (and does not throw) when matchMedia is unavailable", () => {
    // Headless / jsdom / SSR environments may not implement matchMedia.
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(width < 40rem)"));
    expect(result.current).toBe(false);
  });
});
