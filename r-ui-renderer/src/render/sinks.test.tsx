/**
 * Every sink the renderer guards, each judged on the RESOLVED value (a `$ref`
 * to data must not step around it), with the issue's code and path.
 */

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { queryDiagnostics } from "../../test-utils";
import { renderTree } from "./harness.test.helpers";

describe("forbidden props", () => {
  it("drops React escape hatches, style, form overrides and non-handler on… values, in any casing", () => {
    const view = renderTree({
      component: "Button",
      props: {
        dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" },
        DangerouslySetInnerHTML: { __html: "<b>x</b>" },
        style: { backgroundImage: "url(https://evil.test/beacon)" },
        formAction: "https://evil.test/",
        ref: "x",
        onClick: "alert(1)",
        onFocus: { action: "nope" },
        "aria-label": "Save",
      },
      children: ["Save"],
    });
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.querySelector("img, b")).toBeNull();
    expect(button).not.toHaveAttribute("style");
    expect(button).not.toHaveAttribute("formaction");
    expect(view.issuesOf("forbidden-prop")).toEqual([
      ["/root/props/dangerouslySetInnerHTML", false],
      ["/root/props/DangerouslySetInnerHTML", false],
      ["/root/props/style", false],
      ["/root/props/formAction", false],
      ["/root/props/ref", false],
      ["/root/props/onClick", false],
      ["/root/props/onFocus", false],
    ]);
  });

  it("never lets a nested __proto__ key reach a component's prop object", () => {
    const props = JSON.parse('{"labels": {"__proto__": {"polluted": true}, "dismiss": "Close"}}') as Record<string, unknown>;
    const view = renderTree({ component: "Banner", props, children: ["Hi"] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(view.issuesOf("forbidden-prop")).toEqual([["/root/props/labels/__proto__", false]]);
  });
});

describe("ids and names", () => {
  it("drops DOM ids, id references and a control's name; keeps Field's name and Icon's", () => {
    const view = renderTree({
      component: "Stack",
      children: [
        { component: "Input", props: { id: "email", name: "email", "aria-labelledby": "x", "aria-label": "Email" } },
        { component: "Icon", props: { name: "check", label: "Done" } },
      ],
    });
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).not.toHaveAttribute("name");
    expect(input.id).not.toBe("email");
    expect(input).not.toHaveAttribute("aria-labelledby");
    expect(screen.getByRole("img", { name: "Done" })).toBeInTheDocument();
    expect(view.issuesOf("forbidden-prop")).toEqual([
      ["/root/children/0/props/id", false],
      ["/root/children/0/props/name", false],
      ["/root/children/0/props/aria-labelledby", false],
    ]);
  });

  it("refuses a Field name that is not a name", () => {
    const view = renderTree({ component: "Field", props: { name: "__proto__" }, children: [] });
    expect(view.issuesOf("invalid-name")).toEqual([["/root/props/name", false]]);
  });
});

describe("data-* attributes", () => {
  it("passes scalar data-*, drops host axes and values outside a constrained set", () => {
    const view = renderTree({
      component: "Stack",
      props: {
        "data-section": "usage",
        "data-count": 3,
        "data-theme": "aurora",
        "data-input": "coarse",
        "data-density": "huge",
        "data-blob": { a: 1 },
        "data-Upper": "x",
      },
      children: [{ component: "Stack", props: { "data-density": "compact" }, children: ["inner"] }],
    });
    const outer = view.container.firstElementChild;
    expect(outer).toHaveAttribute("data-section", "usage");
    expect(outer).toHaveAttribute("data-count", "3");
    for (const dropped of ["data-theme", "data-input", "data-density", "data-blob", "data-upper"]) {
      expect(outer).not.toHaveAttribute(dropped);
    }
    expect(screen.getByText("inner")).toHaveAttribute("data-density", "compact");
    expect(view.issuesOf("forbidden-prop")).toEqual([
      ["/root/props/data-theme", false],
      ["/root/props/data-input", false],
      ["/root/props/data-Upper", false],
    ]);
    expect(view.issuesOf("invalid-prop-value")).toEqual([
      ["/root/props/data-density", false],
      ["/root/props/data-blob", false],
    ]);
  });
});

describe("URLs", () => {
  const hostile = ["javascript:alert(1)", "JAVASCRIPT:alert(1)", " java\tscript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x"];

  it.each(hostile)("refuses %j as an href, reached through $ref", (href) => {
    const view = renderTree({ component: "Link", props: { href: { $ref: "data.url" } }, children: ["Open"] }, { data: { url: href } });
    expect(view.container.querySelector("[href]")).toBeNull();
    expect(view.issuesOf("refused-url")).toEqual([["/root/props/href", false]]);
  });

  it("keeps relative, http(s), mailto and tel hrefs", () => {
    const view = renderTree({
      component: "Stack",
      children: ["/a", "https://example.test/b", "mailto:a@example.test", "tel:+100"].map((href) => ({
        component: "Link",
        props: { href },
        children: [href],
      })),
    });
    expect([...view.container.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/a",
      "https://example.test/b",
      "mailto:a@example.test",
      "tel:+100",
    ]);
    expect(view.reported).toEqual([]);
  });

  it("judges renamed and nested URL props from the contract: Testimonial sourceUrl, TreeView items[].href", () => {
    const view = renderTree({
      component: "Stack",
      children: [
        { component: "Testimonial", props: { quote: "Great", name: "Ada", sourceUrl: "javascript:alert(1)" } },
        {
          component: "TreeView",
          props: {
            "aria-label": "Files",
            items: [
              { id: "a", label: "Good", href: "/docs" },
              { id: "b", label: "Bad", href: "data:text/html,x" },
            ],
          },
        },
      ],
    });
    expect(view.container.querySelector("blockquote")).not.toHaveAttribute("cite");
    expect(screen.getByText("Good").closest("a")).toHaveAttribute("href", "/docs");
    expect(screen.getByText("Bad").closest("a")).toBeNull();
    expect(view.issuesOf("refused-url")).toEqual([
      ["/root/children/0/props/sourceUrl", false],
      ["/root/children/1/props/items/1/href", false],
    ]);
  });
});

describe("images", () => {
  const image = (src: unknown) => ({ component: "Image", props: { src, alt: "Chart", width: 10, height: 10 } });

  it("refuses a cross-origin image by default and keeps a same-origin or data: raster one", () => {
    const view = renderTree({
      component: "Stack",
      children: [image("https://tracker.test/p.gif"), image("/assets/a.png"), image("data:image/png;base64,AAAA"), image("data:image/svg+xml,<svg/>")],
    });
    const sources = [...view.container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources).toEqual(["/assets/a.png", "data:image/png;base64,AAAA"]);
    expect(view.issuesOf("refused-url")).toEqual([
      ["/root/children/0/props/src", false],
      ["/root/children/3/props/src", false],
    ]);
  });

  it("asks the host's allowImageUrl, and judges every srcSet candidate and nested image URL", () => {
    const allowImageUrl = (url: URL) => url.origin === "https://cdn.example.test";
    const view = renderTree(
      {
        component: "Stack",
        children: [
          image("https://cdn.example.test/a.png"),
          {
            component: "Image",
            props: { src: "https://cdn.example.test/b.png", srcSet: "https://cdn.example.test/b2.png 2x, https://evil.test/b3.png 3x", alt: "B", width: 1, height: 1 },
          },
          {
            component: "AvatarGroup",
            props: { label: "Team", items: { $ref: "data.people" } },
          },
        ],
      },
      { adapters: { allowImageUrl }, data: { people: [{ name: "Ada", src: "https://cdn.example.test/ada.png" }, { name: "Eve", src: "https://evil.test/eve.png" }] } },
    );
    const images = [...view.container.querySelectorAll("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://cdn.example.test/a.png",
      "https://cdn.example.test/b.png",
      "https://cdn.example.test/ada.png",
    ]);
    expect(images.some((img) => img.hasAttribute("srcset"))).toBe(false);
    expect(view.issuesOf("refused-url")).toEqual([
      ["/root/children/1/props/srcSet", false],
      ["/root/children/2/props/items/1/src", false],
    ]);
  });
});

describe("element choices", () => {
  it("keeps an allowed `as` and heading level, drops anything else", () => {
    const view = renderTree({
      component: "Stack",
      children: [
        { component: "Stack", props: { as: "section" }, children: ["a"] },
        { component: "Stack", props: { as: "script" }, children: ["b"] },
        { component: "Text", props: { as: "iframe" }, children: ["c"] },
        { component: "Heading", props: { level: 9 }, children: ["d"] },
        { component: "EmptyState", props: { title: "Nothing", headingLevel: 1 } },
      ],
    });
    expect(screen.getByText("a").tagName).toBe("SECTION");
    expect(screen.getByText("b").tagName).toBe("DIV");
    expect(screen.getByText("c").tagName).toBe("P");
    expect(screen.getByText("d").tagName).toBe("H2");
    expect(view.container.querySelector("script, iframe, h1")).toBeNull();
    expect(view.issuesOf("invalid-prop-value")).toEqual([
      ["/root/children/1/props/as", false],
      ["/root/children/2/props/as", false],
      ["/root/children/3/props/level", false],
      ["/root/children/4/props/headingLevel", false],
    ]);
  });

  it("takes Popover.Content's initialFocus only as a number", () => {
    const view = renderTree({
      component: "Popover",
      children: [
        { component: "Popover.Trigger", children: ["Open"] },
        { component: "Popover.Content", props: { initialFocus: { current: "x" } }, children: ["Panel"] },
      ],
    });
    expect(view.issuesOf("invalid-prop-value")).toEqual([["/root/children/1/props/initialFocus", false]]);
  });

  it("drops an Intl input Intl would throw on; Pricing, which needs one, then fails in place", () => {
    const plans = [{ id: "p", name: "Pro", price: { monthly: 10, annual: 100 }, features: [] }];
    const view = renderTree(
      {
        component: "Stack",
        children: [
          { component: "Pricing", props: { currency: "EURO", plans } },
          { component: "Pricing", props: { currency: "EUR", plans } },
        ],
      },
      { throws: true },
    );
    expect(view.issuesOf("invalid-prop-value")).toEqual([["/root/children/0/props/currency", false]]);
    expect(queryDiagnostics().map(({ code, path }) => [code, path])).toEqual([["render-error", "/root/children/0"]]);
    expect(screen.getAllByText("Pro")).toHaveLength(1);
  });
});

describe("sensitive components", () => {
  const doc = { component: "PasswordInput", props: { "aria-label": "Password" } };

  it("refuses them unless the host allows them", () => {
    renderTree(doc);
    expect(queryDiagnostics().map(({ code, path }) => [code, path])).toEqual([["sensitive-component", "/root/component"]]);
  });

  it("renders them when the host allows that name", () => {
    renderTree(doc, { allowSensitive: ["PasswordInput"] });
    expect(queryDiagnostics()).toEqual([]);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});

describe("dropped contract props", () => {
  it("drops a function-only labels member and keeps the text ones", () => {
    const view = renderTree({ component: "Chip", props: { labels: { remove: "Remove it" } }, children: ["Tag"] });
    expect(view.issuesOf("forbidden-prop")).toEqual([["/root/props/labels/remove", false]]);
    expect(screen.getByText("Tag")).toBeInTheDocument();
  });

  it("gives Markdown the host's image allowlist, never the document's", () => {
    const source = "![Diagram](/assets/diagram.png)";
    const own = renderTree({ component: "Markdown", props: { imageAllowlist: ["/assets/"] }, children: [source] });
    expect(own.container.querySelector("img")).toBeNull();
    expect(own.issuesOf("forbidden-prop")).toEqual([["/root/props/imageAllowlist", false]]);
    own.unmount();
    const hosted = renderTree({ component: "Markdown", children: [source] }, { env: { markdownImageAllowlist: ["/assets/"] } });
    expect(hosted.container.querySelector("img")).toHaveAttribute("src", "/assets/diagram.png");
  });
});

describe("Banner dismissKey", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("namespaces the key per view, so a document cannot write the host's keys", () => {
    renderTree({ component: "Banner", props: { dismissKey: "theme", title: "New" }, children: ["Hi"] }, { namespace: "v1" });
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("theme")).toBeNull();
    expect(localStorage.getItem("r-ui-renderer:v1:theme")).not.toBeNull();
  });
});

describe("handlers", () => {
  it("dispatches the handler with the callback's arguments, the node's names, its path and the contract's event kind", () => {
    const handler = { action: "setState", payload: { path: "state.keys", value: { $ref: "event.value" } } };
    const view = renderTree(
      {
        $each: "data.tables",
        as: "table",
        node: {
          component: "DataTable",
          props: {
            "aria-label": "Rows",
            rows: [{ id: "a" }],
            rowKey: "id",
            selectable: true,
            columns: [{ id: "id" }],
            onSelectedKeysChange: handler,
          },
        },
      },
      { data: { tables: ["t"] } },
    );
    fireEvent.click(screen.getAllByRole("checkbox")[1] as HTMLElement);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    const [given, context] = view.dispatch.mock.calls[0] ?? [];
    expect(given).toBe(handler);
    expect(context?.path).toBe("/root/node/props/onSelectedKeysChange");
    expect(context?.eventValue).toBe("set");
    expect(context?.vars).toEqual({ table: "t", tableIndex: 0 });
    expect(context?.args[0]).toEqual(new Set(["a"]));
  });
});
