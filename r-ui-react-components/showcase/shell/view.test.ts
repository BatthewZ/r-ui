import { afterEach, describe, expect, it, vi } from "vitest";

import { applyView, DEFAULT_VIEW, readView, STORAGE_KEY } from "./view";

const html = document.documentElement;

afterEach(() => {
  localStorage.clear();
  for (const a of ["data-theme", "data-density", "data-input"]) html.removeAttribute(a);
  vi.restoreAllMocks();
});

describe("View settings", () => {
  it("sets one attribute per axis on <html> and removes it for the default", () => {
    applyView({ theme: "nightfall", density: "compact", input: "coarse" });
    expect(html.dataset).toMatchObject({ theme: "nightfall", density: "compact", input: "coarse" });

    applyView(DEFAULT_VIEW);
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(html.hasAttribute("data-density")).toBe(false);
    expect(html.hasAttribute("data-input")).toBe(false);
  });

  it("round-trips through localStorage", () => {
    const view = { theme: "harbour", density: "compact", input: "fine" } as const;
    applyView(view);
    expect(readView()).toEqual(view);
  });

  it("folds unknown or corrupt stored values to the default, field by field", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "nope", density: "compact", input: 3 }));
    expect(readView()).toEqual({ ...DEFAULT_VIEW, density: "compact" });

    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readView()).toEqual(DEFAULT_VIEW);
  });

  it("still applies the view when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    applyView({ theme: "nightfall", density: "comfortable", input: "auto" });
    expect(html.dataset.theme).toBe("nightfall");
  });
});
