/**
 * The built-ins mark their elements with the renderer's own classes only, so
 * their look lives in the stylesheet's components layer and a document's
 * className utility always wins (`src/styles.test.ts` holds the CSS side).
 */

import { describe, expect, it } from "vitest";

import { renderTree } from "../harness.test.helpers";

/** The element's classes that the document did not write. */
function ownClasses(element: Element | null, documentClasses: readonly string[]): string[] {
  expect(element).not.toBeNull();
  return [...(element?.classList ?? [])].filter((name) => !documentClasses.includes(name));
}

describe("built-ins carry renderer classes, never utilities", () => {
  it("Text: base, size, weight and tone, then the document's className untouched", () => {
    const view = renderTree({
      component: "Text",
      props: { as: "span", size: "body-2", weight: "medium", tone: "muted", className: "text-body-1 text-fg-error" },
      children: ["Hi"],
    });
    const element = view.container.querySelector("span");
    expect(ownClasses(element, ["text-body-1", "text-fg-error"])).toEqual([
      "r-renderer-text",
      "r-renderer-text-body-2",
      "r-renderer-weight-medium",
      "r-renderer-tone-muted",
    ]);
    expect(element?.className.endsWith("text-body-1 text-fg-error")).toBe(true);
  });

  it("Text: no modifier for an absent or unknown value", () => {
    const view = renderTree({ component: "Text", props: { size: "huge", tone: "loud" }, children: ["Hi"] });
    expect(view.container.querySelector("p")?.className).toBe("r-renderer-text");
  });

  it("Heading: the level's size by default, the look `size` names otherwise", () => {
    const view = renderTree({
      component: "Stack",
      children: [
        { component: "Heading", props: { level: 3 }, children: ["Default"] },
        { component: "Heading", props: { level: 1, size: "h4", tone: "info", className: "text-h2" }, children: ["Sized"] },
      ],
    });
    expect(ownClasses(view.container.querySelector("h3"), [])).toEqual(["r-renderer-heading", "r-renderer-heading-h3"]);
    expect(ownClasses(view.container.querySelector("h1"), ["text-h2"])).toEqual([
      "r-renderer-heading",
      "r-renderer-heading-h4",
      "r-renderer-tone-info",
    ]);
  });

  it("Icon: base and tone, then the document's className", () => {
    const view = renderTree({ component: "Icon", props: { name: "check", tone: "success", className: "size-full" } });
    const svg = view.container.querySelector("svg");
    expect(ownClasses(svg, ["size-full"]).filter((name) => name.startsWith("r-renderer-"))).toEqual([
      "r-renderer-icon",
      "r-renderer-tone-success",
    ]);
    expect(ownClasses(svg, ["size-full"]).filter((name) => !name.startsWith("r-renderer-") && !name.startsWith("lucide"))).toEqual([]);
  });
});
