import { afterEach, describe, expect, it } from "vitest";

import { themeScript } from "../../src/util/preferences";
import { PREFERENCES, READOUT_TOKENS, readTokens, STORAGE_KEY } from "./view";

const html = document.documentElement;

afterEach(() => {
  localStorage.clear();
  for (const a of ["data-theme", "data-density", "data-input"]) html.removeAttribute(a);
});

describe("the showcase's View settings", () => {
  // The browser checks set the View by writing this exact shape under this key
  // and reloading; the pre-paint script must honour it.
  it("restores what the browser checks write, before React runs", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "nightfall", density: "compact", input: "coarse" }));
    new Function(themeScript(PREFERENCES))();
    expect(html.dataset).toMatchObject({ theme: "nightfall", density: "compact", input: "coarse" });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "default", density: "comfortable", input: "auto" }));
    new Function(themeScript(PREFERENCES))();
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(html.hasAttribute("data-density")).toBe(false);
    expect(html.hasAttribute("data-input")).toBe(false);
  });

  it("reads one value per readout token and removes its probe", () => {
    const before = document.body.childElementCount;
    const readings = readTokens();
    expect(readings.map((r) => r.token)).toEqual([...READOUT_TOKENS]);
    expect(document.body.childElementCount).toBe(before);
  });
});
