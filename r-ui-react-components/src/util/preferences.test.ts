import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyPreferences, readStoredPreferences, storePreferences, themeScript } from "./preferences";

// App-defined theme names only: the library gives no example theme a privilege.
const THEMES = ["default", "aurora", "midnight"] as const;
const KEY = "app:prefs";
const html = document.documentElement;

const clearRoot = () => {
  html.removeAttribute("data-theme");
  html.removeAttribute("data-density");
  html.removeAttribute("data-input");
};

/** Runs the script exactly as a browser would run the inline <script> body. */
const runScript = (script: string) => new Function(script)() as void;

beforeEach(() => {
  clearRoot();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("readStoredPreferences", () => {
  it("reads back each field that is valid, and only those", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "aurora", density: "compact", input: "coarse" }));
    expect(readStoredPreferences(KEY, THEMES)).toEqual({ theme: "aurora", density: "compact", input: "coarse" });

    localStorage.setItem(KEY, JSON.stringify({ theme: "sepia", density: "cosy", input: 3 }));
    expect(readStoredPreferences(KEY, THEMES)).toEqual({});
  });

  it("accepts any non-empty theme without a registry, never an empty one", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "sepia" }));
    expect(readStoredPreferences(KEY, null)).toEqual({ theme: "sepia" });
    localStorage.setItem(KEY, JSON.stringify({ theme: "  " }));
    expect(readStoredPreferences(KEY, null)).toEqual({});
  });

  it("reads malformed JSON, a non-object and an absent key as nothing saved", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readStoredPreferences(KEY, THEMES)).toEqual({});
    localStorage.setItem(KEY, "\"aurora\"");
    expect(readStoredPreferences(KEY, THEMES)).toEqual({});
    expect(readStoredPreferences("other", THEMES)).toEqual({});
  });

  it("reads storage that throws as nothing saved", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readStoredPreferences(KEY, THEMES)).toEqual({});
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});

describe("storePreferences", () => {
  it("merges a patch over what is saved", () => {
    storePreferences(KEY, { theme: "aurora" });
    storePreferences(KEY, { density: "compact" });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ theme: "aurora", density: "compact" });
  });

  it("swallows a storage that throws on write", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => storePreferences(KEY, { theme: "aurora" })).not.toThrow();
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});

describe("applyPreferences", () => {
  it("sets a non-default value and removes the attribute for a default", () => {
    applyPreferences({ theme: "aurora", density: "compact", input: "fine" }, "default", html);
    expect(html.dataset).toMatchObject({ theme: "aurora", density: "compact", input: "fine" });

    applyPreferences({ theme: "default", density: "comfortable", input: "auto" }, "default", html);
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(html.hasAttribute("data-density")).toBe(false);
    expect(html.hasAttribute("data-input")).toBe(false);
  });

  it("leaves an axis alone when the preferences do not mention it", () => {
    html.setAttribute("data-density", "compact");
    applyPreferences({ theme: "aurora" }, "default", html);
    expect(html.getAttribute("data-density")).toBe("compact");
  });
});

describe("themeScript", () => {
  it("applies every saved axis to <html> when run as an inline script", () => {
    localStorage.setItem("r-ui:preferences", JSON.stringify({ theme: "midnight", density: "compact", input: "coarse" }));
    runScript(themeScript({ themes: THEMES }));
    expect(html.dataset).toMatchObject({ theme: "midnight", density: "compact", input: "coarse" });
  });

  it("honours the storage key and treats the first registered theme as the default", () => {
    html.setAttribute("data-theme", "aurora");
    localStorage.setItem(KEY, JSON.stringify({ theme: "midnight" }));
    runScript(themeScript({ storageKey: KEY, themes: ["midnight", "aurora"] }));
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("ignores a saved theme outside the registry and leaves the page on its defaults", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "sepia", density: "cosy" }));
    runScript(themeScript({ storageKey: KEY, themes: THEMES }));
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(html.hasAttribute("data-density")).toBe(false);
  });

  it("never throws when storage does", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => runScript(themeScript())).not.toThrow();
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("cannot be broken out of by a hostile key or theme name", () => {
    const script = themeScript({ storageKey: "</script><script>alert(1)</script>", themes: ["a</script>"] });
    expect(script).not.toMatch(/<\/script/i);
    expect(script).not.toContain("<");
    expect(() => runScript(script)).not.toThrow();
  });
});
