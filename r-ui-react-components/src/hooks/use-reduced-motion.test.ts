import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePrefersReducedMotion } from "./use-reduced-motion";

describe("usePrefersReducedMotion", () => {
  let listeners: Map<string, Set<EventListener>>;
  let matches: boolean;

  beforeEach(() => {
    listeners = new Map();
    matches = false;

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return matches;
        },
        media: query,
        addEventListener: (_event: string, handler: EventListener) => {
          if (!listeners.has(_event)) listeners.set(_event, new Set());
          listeners.get(_event)!.add(handler);
        },
        removeEventListener: (_event: string, handler: EventListener) => {
          listeners.get(_event)?.delete(handler);
        },
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when no reduced-motion preference is set", () => {
    matches = false;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion matches", () => {
    matches = true;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("updates when the media query change fires", () => {
    matches = false;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    // Simulate the user changing their OS preference
    matches = true;
    const changeListeners = listeners.get("change");
    expect(changeListeners).toBeDefined();
    expect(changeListeners!.size).toBeGreaterThan(0);

    // Fire the change event inside act — useSyncExternalStore will re-call getSnapshot
    act(() => {
      for (const handler of changeListeners!) {
        handler(new Event("change"));
      }
    });

    expect(result.current).toBe(true);
  });

  it("cleans up the listener on unmount", () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());

    const changeListeners = listeners.get("change");
    expect(changeListeners).toBeDefined();
    expect(changeListeners!.size).toBeGreaterThan(0);

    unmount();

    expect(changeListeners!.size).toBe(0);
  });
});

/**
 * The suite above stubs `matchMedia` in `beforeEach`, so it only ever exercised the
 * world where the API exists. Every environment where it does not — SSR, jsdom, any
 * headless runner — went untested, and the hook threw there.
 */
describe("usePrefersReducedMotion without matchMedia", () => {
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");

  beforeEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, "matchMedia", original);
  });

  it("reports no preference rather than throwing", () => {
    expect(typeof window.matchMedia).toBe("undefined");
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("unmounts cleanly, so the absent-API path installs no listener to leak", () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(() => unmount()).not.toThrow();
  });
});
