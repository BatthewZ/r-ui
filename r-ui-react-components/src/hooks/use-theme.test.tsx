import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEY, useTheme } from "./use-theme";

// App-defined names throughout. The hook has no theme list of its own beyond
// `default`, so testing it against an example theme's name would test that
// theme rather than the hook, and would quietly give it a privilege.
const APP_THEMES = ["default", "aurora", "midnight"] as const;

describe("useTheme with a registered theme list", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("returns 'default' when no data-theme attribute is set", () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.theme).toBe("default");
  });

  it("returns exactly the themes it was given", () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.themes).toBe(APP_THEMES);
  });

  it("reads an app-registered theme from the data-theme attribute", () => {
    document.documentElement.setAttribute("data-theme", "aurora");
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.theme).toBe("aurora");
  });

  it("folds a data-theme value outside the registry to the first entry", () => {
    document.documentElement.setAttribute("data-theme", "nonexistent");
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.theme).toBe("default");
  });

  // NOT "persists": the write is one-way. Nothing in this package reads the key
  // back, which the README states as intentional — see the read-back test below.
  it("setTheme sets data-theme and writes the localStorage key nothing reads back", () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));

    act(() => {
      result.current.setTheme("midnight");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("midnight");
  });

  it("setTheme(first entry) removes the data-theme attribute and localStorage entry", () => {
    document.documentElement.setAttribute("data-theme", "aurora");
    localStorage.setItem(STORAGE_KEY, "aurora");

    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));

    act(() => {
      result.current.setTheme("default");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("treats the first entry as the default even when it is not named 'default'", () => {
    const OWN = ["midnight", "aurora"] as const;
    document.documentElement.setAttribute("data-theme", "aurora");
    const { result } = renderHook(() => useTheme({ themes: OWN }));

    act(() => {
      result.current.setTheme("midnight");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("updates reactively when the data-theme attribute changes externally", async () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.theme).toBe("default");

    act(() => {
      document.documentElement.setAttribute("data-theme", "aurora");
    });

    // MutationObserver is async; flush microtasks
    await vi.waitFor(() => {
      expect(result.current.theme).toBe("aurora");
    });
  });

  it("handles localStorage errors gracefully (e.g. private browsing)", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });

    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));

    act(() => {
      result.current.setTheme("aurora");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("aurora");

    setItemSpy.mockRestore();
  });
});

describe("useTheme with no registered list", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("reports only the one theme the design system defines", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.themes).toEqual(["default"]);
  });

  it("falls back to 'default' when the attribute is absent", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("default");
  });

  // The point of registry-free mode. Filtering against a list nobody supplied
  // would report every app-defined theme as "default", widened to
  // all consumers. Reporting the attribute as-is is the honest read.
  it("reports an unregistered data-theme value as-is instead of folding it to default", () => {
    document.documentElement.setAttribute("data-theme", "aurora");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("aurora");
  });

  it("keeps a stable themes identity across re-renders", () => {
    const { result, rerender } = renderHook(() => useTheme());
    const first = result.current.themes;
    rerender();
    expect(result.current.themes).toBe(first);
  });
});

describe("the localStorage write is one-way", () => {
  // Guards the documented contract, not a hoped-for one: the README says
  // "Persistence is not included." If someone later implements restore-on-init,
  // this fails and forces the README, AGENTS.md and the docblock to move with it.
  it("does not restore a stored theme on mount", () => {
    localStorage.setItem(STORAGE_KEY, "aurora");
    document.documentElement.removeAttribute("data-theme");

    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));

    expect(result.current.theme).not.toBe("aurora");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
