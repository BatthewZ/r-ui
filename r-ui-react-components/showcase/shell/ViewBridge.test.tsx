import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { STORAGE_KEY, THEMES } from "./view";
import { ViewBridge } from "./ViewBridge";

const html = document.documentElement;

afterEach(() => {
  localStorage.clear();
  for (const a of ["data-theme", "data-density", "data-input", "dir"]) html.removeAttribute(a);
});

describe("ViewBridge", () => {
  it("switches the View live through the preference hooks, saving it as the switchers do", () => {
    render(<ViewBridge />);
    const theme = THEMES[1].value;
    window.__showcase!.setView({ theme, density: "compact", input: "coarse", dir: "rtl" });
    expect(html.dataset).toMatchObject({ theme, density: "compact", input: "coarse" });
    expect(html.dir).toBe("rtl");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ theme, density: "compact", input: "coarse" });

    // A partial View moves only its own axes; the defaults remove their attributes.
    window.__showcase!.setView({ density: "comfortable", dir: "ltr" });
    expect(html.hasAttribute("data-density")).toBe(false);
    expect(html.hasAttribute("dir")).toBe(false);
    expect(html.dataset).toMatchObject({ theme, input: "coarse" });
  });

  it("refuses a value outside the app's lists and changes nothing", () => {
    render(<ViewBridge />);
    expect(() => window.__showcase!.setView({ density: "compact", theme: "aurora" })).toThrow(/theme "aurora" is not one of/);
    expect(() => window.__showcase!.setView({ input: "pen" })).toThrow(/input "pen" is not one of auto, fine, coarse/);
    expect(html.hasAttribute("data-density")).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("is gone once the app unmounts", () => {
    const { unmount } = render(<ViewBridge />);
    expect(typeof window.__showcase?.setView).toBe("function");
    unmount();
    expect(window.__showcase).toBeUndefined();
  });
});
