import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("returns debounced value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("ab");
  });

  it("resets timer when value changes rapidly", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Still "a" because the timer was reset
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("abc");
  });

  it("returns value immediately when delay is 0", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "ab" });

    // With delay 0, the setState happens synchronously in useEffect
    // but we need to flush the effect
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe("ab");
  });

  it("schedules exactly one timeout per value change, clearing the one it replaces", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);

    rerender({ value: "b" });

    // Exactly one new timer, and exactly one cleanup — of the timer it replaced.
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0]?.value);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("clears exactly the pending timeout on unmount", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const { unmount } = renderHook(() => useDebounce("hello", 300));

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    const pending = setTimeoutSpy.mock.results[0]?.value;
    setTimeoutSpy.mockRestore();

    // Spy only across the unmount so the count is the effect cleanup alone.
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(pending);
    clearTimeoutSpy.mockRestore();
  });
});
