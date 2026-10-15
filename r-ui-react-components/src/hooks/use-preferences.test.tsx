import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREFERENCES_STORAGE_KEY } from "../util/preferences";
import { useDensity, useInputMode, useTheme } from "./use-preferences";

// App-defined names throughout: an example theme's name in a fixture would give it a privilege.
const APP_THEMES = ["default", "aurora", "midnight"] as const;
const html = document.documentElement;
const saved = (key = PREFERENCES_STORAGE_KEY) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown;

beforeEach(() => {
  html.removeAttribute("data-theme");
  html.removeAttribute("data-density");
  html.removeAttribute("data-input");
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTheme with a registered theme list", () => {
  it("returns the first entry when no data-theme is set, and exactly the themes given", () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.theme).toBe("default");
    expect(result.current.themes).toBe(APP_THEMES);
  });

  it("reads a registered theme from the attribute and folds an unknown one to the first entry", () => {
    html.setAttribute("data-theme", "aurora");
    const { result, rerender } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(result.current.theme).toBe("aurora");
    act(() => html.setAttribute("data-theme", "nonexistent"));
    rerender();
    expect(result.current.theme).toBe("default");
  });

  it("setTheme applies the theme and saves it; the default removes the attribute but is saved too", () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    act(() => result.current.setTheme("midnight"));
    expect(html.getAttribute("data-theme")).toBe("midnight");
    expect(saved()).toEqual({ theme: "midnight" });

    act(() => result.current.setTheme("default"));
    expect(html.hasAttribute("data-theme")).toBe(false);
    // Saved, not cleared: a server-rendered data-theme must not win over the viewer's choice.
    expect(saved()).toEqual({ theme: "default" });
  });

  it("reads back what it wrote: a fresh mount restores the saved theme", () => {
    const first = renderHook(() => useTheme({ themes: APP_THEMES }));
    act(() => first.result.current.setTheme("aurora"));
    first.unmount();
    html.removeAttribute("data-theme"); // a reload: the attribute is gone, storage is not

    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(html.getAttribute("data-theme")).toBe("aurora");
    expect(result.current.theme).toBe("aurora");
  });

  it("restores nothing from an invalid saved value", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: "sepia" }));
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(result.current.theme).toBe("default");

    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{broken");
    renderHook(() => useTheme({ themes: APP_THEMES }));
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("uses its own storage key", () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES, storageKey: "app:view" }));
    act(() => result.current.setTheme("aurora"));
    expect(saved("app:view")).toEqual({ theme: "aurora" });
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("treats the first entry as the default even when it is not named 'default'", () => {
    html.setAttribute("data-theme", "aurora");
    const { result } = renderHook(() => useTheme({ themes: ["midnight", "aurora"] }));
    act(() => result.current.setTheme("midnight"));
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("follows the attribute when something else changes it", async () => {
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    act(() => html.setAttribute("data-theme", "aurora"));
    await vi.waitFor(() => expect(result.current.theme).toBe("aurora"));
  });

  it("still applies the theme when storage throws on read and write", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { result } = renderHook(() => useTheme({ themes: APP_THEMES }));
    act(() => result.current.setTheme("aurora"));
    expect(html.getAttribute("data-theme")).toBe("aurora");
    await vi.waitFor(() => expect(result.current.theme).toBe("aurora"));
    expect(getItem.mock.calls.length).toBeGreaterThan(0);
    expect(setItem).toHaveBeenCalledTimes(0); // the read for the merge threw first
  });

  it("does not re-subscribe or re-restore for an inline themes literal", () => {
    const { result, rerender } = renderHook(() => useTheme({ themes: ["default", "aurora"] }));
    act(() => result.current.setTheme("aurora"));
    // The restore effect must not re-run and must not fight a change made since mount.
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: "default" }));
    rerender();
    expect(html.getAttribute("data-theme")).toBe("aurora");
  });
});

describe("useTheme with no registered list", () => {
  it("reports the attribute as-is, and ['default'] as the themes", () => {
    html.setAttribute("data-theme", "aurora");
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("aurora");
    const first = result.current.themes;
    expect(first).toEqual(["default"]);
    rerender();
    expect(result.current.themes).toBe(first);
  });

  it("treats an empty attribute as unset", () => {
    html.setAttribute("data-theme", " ");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("default");
  });
});

describe("useDensity", () => {
  it("reads, writes, saves and reads back density", async () => {
    const first = renderHook(() => useDensity());
    expect(first.result.current.density).toBe("comfortable");
    act(() => first.result.current.setDensity("compact"));
    expect(html.getAttribute("data-density")).toBe("compact");
    await vi.waitFor(() => expect(first.result.current.density).toBe("compact"));
    expect(saved()).toEqual({ density: "compact" });
    first.unmount();

    html.removeAttribute("data-density");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("compact");

    act(() => result.current.setDensity("comfortable"));
    expect(html.hasAttribute("data-density")).toBe(false);
  });

  it("ignores an invalid saved density", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ density: "cosy" }));
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("comfortable");
    expect(html.hasAttribute("data-density")).toBe(false);
  });

  it("shares one saved object with the theme", () => {
    const theme = renderHook(() => useTheme({ themes: APP_THEMES }));
    const density = renderHook(() => useDensity());
    act(() => theme.result.current.setTheme("aurora"));
    act(() => density.result.current.setDensity("compact"));
    expect(saved()).toEqual({ theme: "aurora", density: "compact" });
  });
});

describe("useInputMode", () => {
  // Per test, never global: each branch of the pointer query gets its own run.
  const stubPointer = (coarse: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query === "(pointer: coarse)" ? coarse : false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves auto from the pointer query, per device", () => {
    stubPointer(true);
    const touch = renderHook(() => useInputMode());
    expect(touch.result.current).toMatchObject({ input: "auto", resolved: "coarse" });
    touch.unmount();
    vi.unstubAllGlobals();

    stubPointer(false);
    const mouse = renderHook(() => useInputMode());
    expect(mouse.result.current).toMatchObject({ input: "auto", resolved: "fine" });
  });

  it("forces a mode over the device, saves it, and auto removes the attribute", async () => {
    stubPointer(false);
    const { result } = renderHook(() => useInputMode());
    act(() => result.current.setInput("coarse"));
    expect(html.getAttribute("data-input")).toBe("coarse");
    await vi.waitFor(() => expect(result.current).toMatchObject({ input: "coarse", resolved: "coarse" }));
    expect(saved()).toEqual({ input: "coarse" });

    act(() => result.current.setInput("auto"));
    expect(html.hasAttribute("data-input")).toBe(false);
    await vi.waitFor(() => expect(result.current.resolved).toBe("fine"));
  });

  it("reads back a saved mode on mount", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ input: "fine" }));
    const { result } = renderHook(() => useInputMode());
    expect(html.getAttribute("data-input")).toBe("fine");
    expect(result.current.input).toBe("fine");
  });
});
