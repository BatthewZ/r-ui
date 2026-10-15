import { render, screen, within } from "@testing-library/react";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it } from "vitest";

import { RouterProvider } from "../../util/router";
import { imageAllowed, Markdown, type MarkdownComponents } from "./Markdown";

/**
 * The parser has its own suite (markdown-parse.test.ts). Here: what reaches the
 * DOM. Prose sizing, the UI islands' sizes and overflow are measured in a
 * browser (`scripts/browser/content-markdown.js`).
 */
describe("Markdown", () => {
  it("renders inside a prose region", () => {
    const { container } = render(<Markdown>{"Hello **world**"}</Markdown>);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("prose");
    expect(root).not.toHaveClass("max-w-measure");
    expect(within(root).getByText("world").tagName).toBe("STRONG");
  });

  it("offsets heading levels and caps them at h6", () => {
    render(<Markdown headingOffset={1}>{"# Title\n\n###### Deep"}</Markdown>);
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 6, name: "Deep" })).toBeInTheDocument();
  });

  it("routes an internal link through the Link primitive, in the same tab", () => {
    render(<Markdown>{"See [the docs](/docs/start)."}</Markdown>);
    const link = screen.getByRole("link", { name: "the docs" });
    expect(link).toHaveAttribute("href", "/docs/start");
    expect(link).not.toHaveAttribute("target");
    expect(link).toHaveClass("r-primitives-link");
  });

  it("opens an external link in a new tab, with the glyph, noopener and the description", () => {
    render(<Markdown labels={{ newTab: "(neuer Tab)" }}>{"[Example](https://example.com) and <https://example.org>"}</Markdown>);
    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")?.split(" ").sort()).toEqual(["noopener", "noreferrer"]);
    expect(link).toHaveAccessibleDescription("(neuer Tab)");
    expect(link.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: "https://example.org" })).toHaveAttribute("target", "_blank");
  });

  it("treats an href a browser resolves to another host (`/\\host`) as external, never routed", () => {
    function RouterLink(props: ComponentPropsWithRef<"a">) {
      return <a data-router="" {...props} />;
    }
    render(
      <RouterProvider link={RouterLink}>
        <Markdown>{"[off](/\\evil.example/x) [in](/docs) [mail](mailto:a@b.example)"}</Markdown>
      </RouterProvider>,
    );
    const off = screen.getByRole("link", { name: "off" });
    expect(off).toHaveAttribute("href", "/\\evil.example/x");
    expect(off).toHaveAttribute("target", "_blank");
    expect(off).toHaveAccessibleDescription("(opens in a new tab)");
    expect(off).not.toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "in" })).toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "in" })).not.toHaveAttribute("target");
    const mail = screen.getByRole("link", { name: "mail" });
    expect(mail).not.toHaveAttribute("target");
    expect(mail).not.toHaveAttribute("data-router");
  });

  it("never renders a link inside a link: the inner one is the link", () => {
    const { container } = render(<Markdown>{"[a [b](/c) d](/e) and [see <https://a.example>](/x)"}</Markdown>);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["b", "/c"],
      // The external one carries its glyph and new-tab description inside.
      [expect.stringContaining("https://a.example"), "https://a.example"],
    ]);
    expect(container).toHaveTextContent("[a b d](/e) and [see https://a.example");
  });

  it("refuses script and data links, leaving their text and no href anywhere", () => {
    const { container } = render(
      <Markdown>
        {"[a](javascript:alert(1)) [b](JAVASCRIPT:alert(2)) [c](data:text/html,<script>x</script>) <javascript:alert(3)> [ok](/fine)"}
      </Markdown>,
    );
    const hrefs = [...container.querySelectorAll("[href]")].map((el) => el.getAttribute("href"));
    expect(hrefs).toEqual(["/fine"]);
    expect(container.textContent).toContain("a b c");
  });

  it("renders raw HTML as visible text and drops comments", () => {
    const { container } = render(
      <Markdown>{'<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n<!-- hidden -->\n\nafter'}</Markdown>,
    );
    expect(container.querySelector("script, img, iframe")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror="alert(2)">')).toBeInTheDocument();
    expect(container.textContent).not.toContain("hidden");
  });

  it("loads no image without an allowlist and keeps its alt text", () => {
    const { container } = render(<Markdown>{"![A chart of revenue](https://cdn.example.com/chart.png)"}</Markdown>);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("A chart of revenue")).toHaveClass("r-content-md-image-alt");
  });

  it("loads an image from the allowlist", () => {
    render(
      <Markdown imageAllowlist={["https://cdn.example.com/img/", "/assets/"]}>
        {"![Chart](https://cdn.example.com/img/chart.png) ![Logo](/assets/logo.png) ![Other](https://evil.example/x.png)"}
      </Markdown>,
    );
    expect(screen.getByRole("img", { name: "Chart" })).toHaveAttribute("src", "https://cdn.example.com/img/chart.png");
    expect(screen.getByRole("img", { name: "Logo" })).toHaveAttribute("src", "/assets/logo.png");
    expect(screen.queryByRole("img", { name: "Other" })).toBeNull();
  });

  it.each([
    ["a look-alike host", "https://cdn.example.com.evil.example/img/x.png"],
    ["a path climbing out", "/assets/../private/x.png"],
    ["another path on the host", "https://cdn.example.com/private/x.png"],
    ["a protocol-relative URL", "//cdn.example.com/img/x.png"],
    ["another scheme on the host", "http://cdn.example.com/img/x.png"],
    ["a backslash that makes the path another host", "/\\evil.example/assets/x.png"],
  ])("refuses %s", (_label, src) => {
    expect(imageAllowed(src, ["https://cdn.example.com/img/", "/assets/"])).toBe(false);
  });

  it("keeps an image whose root-relative src does not parse as its alt text instead of throwing", () => {
    render(<Markdown imageAllowlist={["/assets/"]}>{"![Diagram](/\\evil.example:99999/assets/x.png)"}</Markdown>);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Diagram")).toHaveClass("r-content-md-image-alt");
  });

  it("renders a fenced block as a CodeBlock and a table as the library Table, both UI islands", () => {
    const { container } = render(
      <Markdown>{"```ts\nconst a = 1;\n```\n\n| Plan | Price |\n| --- | --: |\n| Pro | $10 |"}</Markdown>,
    );
    const block = container.querySelector("[data-highlight]");
    expect(block).toHaveAttribute("data-not-prose");
    expect(block?.querySelector("pre")).toHaveTextContent("const a = 1;");
    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveAttribute("data-not-prose");
    expect(within(table).getByRole("columnheader", { name: "Price" })).toHaveClass("text-end");
    expect(within(table).getByRole("cell", { name: "$10" })).toHaveClass("text-end");
  });

  it("renders task items with a spoken state and no tab stop", () => {
    render(<Markdown labels={{ taskDone: "Erledigt:" }}>{"- [x] Ship it\n- [ ] Write docs\n- plain"}</Markdown>);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Erledigt: Ship it");
    expect(items[0]).toHaveAttribute("data-checked", "true");
    expect(items[1]).toHaveTextContent("To do: Write docs");
    expect(items[2]).not.toHaveAttribute("data-checked");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("nests lists", () => {
    render(<Markdown>{"- outer\n  - inner\n    - innermost"}</Markdown>);
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(3);
    expect(lists[0]).toContainElement(lists[2]!);
  });

  it("lets a caller override a renderer, which receives already-judged values", () => {
    const seen: string[] = [];
    const link: MarkdownComponents["link"] = ({ href, external, children }) => {
      seen.push(`${href}|${external}`);
      return <a href={href} data-custom="">{children}</a>;
    };
    const heading: MarkdownComponents["heading"] = ({ level, children }) => <div role="heading" aria-level={level}>{children}</div>;
    render(
      <Markdown components={{ link, heading, paragraph: undefined }} headingOffset={2}>
        {"# T\n\n[in](/a) [out](https://x.example) [bad](javascript:alert(1))"}
      </Markdown>,
    );
    expect(seen).toEqual(["/a|false", "https://x.example|true"]);
    expect(screen.getByRole("heading", { level: 3, name: "T" }).tagName).toBe("DIV");
    // An override given as undefined keeps the default.
    expect(screen.getByRole("link", { name: "in" }).closest("p")).not.toBeNull();
  });

  it("survives hostile depth and width without throwing", () => {
    const deep = ">".repeat(500) + " deep\n\n" + Array.from({ length: 300 }, (_, k) => " ".repeat(k * 2) + "- x").join("\n");
    const wide = `| ${Array.from({ length: 60 }, (_, k) => `h${k}`).join(" | ")} |\n|${" --- |".repeat(60)}`;
    expect(() => render(<Markdown>{`${deep}\n\n${wide}`}</Markdown>)).not.toThrow();
    expect(screen.getByText(/deep/)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(60);
  });
});
