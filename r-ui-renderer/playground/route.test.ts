import { afterEach, describe, expect, it } from "vitest";

import { applyViewAxes, parseRoute } from "./route";

describe("parseRoute", () => {
  it("is the playground without a view", () => {
    expect(parseRoute("")).toEqual({ kind: "playground" });
    expect(parseRoute("?theme=aurora")).toEqual({ kind: "playground" });
  });

  it("reads every axis of a view", () => {
    expect(parseRoute("?view=ops-dashboard&theme=aurora&density=compact&input=coarse&stream=24")).toEqual({
      kind: "view",
      name: "ops-dashboard",
      theme: "aurora",
      density: "compact",
      input: "coarse",
      stream: 24,
    });
  });

  it("leaves out the axes it was not given", () => {
    expect(parseRoute("?view=builtin")).toEqual({ kind: "view", name: "builtin" });
  });

  it("takes any theme name and stream=0 (all at once)", () => {
    expect(parseRoute("?view=a&theme=midnight%20blue&stream=0")).toEqual({ kind: "view", name: "a", theme: "midnight blue", stream: 0 });
  });

  it.each([
    ["?view=", "`view` names no document."],
    ["?view=a&theme=", "`theme` is empty."],
    ["?view=a&density=cosy", '`density` is "cosy", not one of comfortable, compact.'],
    ["?view=a&input=auto", '`input` is "auto", not one of coarse, fine.'],
    ["?view=a&stream=-1", '`stream` is "-1", not a whole number of characters per frame.'],
    ["?view=a&stream=2.5", '`stream` is "2.5", not a whole number of characters per frame.'],
    ["?view=a&stream=", '`stream` is "", not a whole number of characters per frame.'],
  ])("refuses %s rather than ignoring it", (search, message) => {
    expect(parseRoute(search)).toEqual({ kind: "invalid", message });
  });
});

describe("applyViewAxes", () => {
  const root = document.documentElement;
  afterEach(() => {
    for (const name of ["data-theme", "data-input", "data-density"]) root.removeAttribute(name);
  });

  it("sets the theme and input the route names", () => {
    applyViewAxes({ kind: "view", name: "a", theme: "aurora", input: "fine", density: "compact" }, root);
    expect(root.getAttribute("data-theme")).toBe("aurora");
    expect(root.getAttribute("data-input")).toBe("fine");
    // Density is the host's option on the view, not the page's.
    expect(root.hasAttribute("data-density")).toBe(false);
  });

  it("clears an axis the route leaves out, so nothing saved leaks in", () => {
    root.setAttribute("data-theme", "midnight");
    root.setAttribute("data-input", "coarse");
    root.setAttribute("data-density", "compact");
    applyViewAxes({ kind: "view", name: "a" }, root);
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.hasAttribute("data-input")).toBe(false);
    expect(root.hasAttribute("data-density")).toBe(false);
  });
});
