import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CodeBlock } from "./CodeBlock";
import { MAX_HIGHLIGHT_LINE } from "./code-highlight";

/**
 * jsdom has no CSS, so the scroll, the gutter (`::before`), the band colours and
 * contrast are a browser check (`scripts/browser/content-code.js`). Here: the
 * DOM structure, the lazy highlighting (lowlight really loads, in-process), the
 * controls and their names.
 */
const lineTexts = (root: HTMLElement) => [...root.querySelectorAll("[data-line]")].map((line) => line.textContent);

describe("CodeBlock", () => {
  it("renders plain text first, then lowlight's tokens once it has loaded", async () => {
    const { container } = render(<CodeBlock code={"const answer = 42;\n"} language="ts" />);
    const root = container.firstElementChild as HTMLElement;
    // First paint: the readable fallback, already the right text.
    expect(lineTexts(root)).toEqual(["const answer = 42;"]);
    expect(root).toHaveAttribute("data-highlight", "pending");

    const keyword = await screen.findByText("const");
    expect(keyword).toHaveAttribute("data-token", "keyword");
    expect(keyword).toHaveClass("text-code-keyword", "font-semibold");
    expect(screen.getByText("42")).toHaveClass("text-code-number");
    expect(root).toHaveAttribute("data-highlight", "on");
    expect(lineTexts(root)).toEqual(["const answer = 42;"]);
  });

  it("never colours without a language, and never guesses one", async () => {
    const { container } = render(<CodeBlock code="const answer = 42;" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-highlight", "off");
    expect(root.querySelector("[data-token]")).toBeNull();
  });

  it("falls back to plain text for an unknown language and past the line budget", async () => {
    const { container } = render(
      <>
        <CodeBlock code="++++[>++<-]" language="brainfuck" />
        <CodeBlock code={`const s = "${"a".repeat(MAX_HIGHLIGHT_LINE)}";`} language="ts" />
        <CodeBlock code="let ok = 1;" language="ts" />
      </>,
    );
    // The third block is the positive control: it proves lowlight loaded.
    await screen.findByText("let");
    const [unknown, long] = [...container.querySelectorAll<HTMLElement>("[data-highlight]")];
    expect(unknown).toHaveAttribute("data-highlight", "off");
    expect(long).toHaveAttribute("data-highlight", "off");
    expect(unknown!.querySelector("[data-token]")).toBeNull();
    expect(long!.querySelector("[data-token]")).toBeNull();
  });

  it("renders markup in the code as text, never as elements", async () => {
    const { container } = render(<CodeBlock code={'<script>alert(1)</script>\n<img src=x onerror="alert(2)">'} language="html" />);
    expect(await screen.findAllByText("script", { selector: "[data-token]" })).toHaveLength(2);
    expect(container.querySelector("script, img")).toBeNull();
    expect(lineTexts(container.firstElementChild as HTMLElement)).toEqual([
      "<script>alert(1)</script>",
      '<img src=x onerror="alert(2)">',
    ]);
  });

  it("keeps one line per source line, CRLF included, and empty lines as lines", () => {
    const { container } = render(<CodeBlock code={"a\r\n\r\nb\n"} />);
    expect(lineTexts(container.firstElementChild as HTMLElement)).toEqual(["a", "", "b"]);
  });

  it("numbers lines in generated content and marks the highlighted ones", () => {
    const { container } = render(<CodeBlock code={"one\ntwo\nthree\nfour"} lineNumbers highlightLines={[2, 4, 9]} />);
    const code = container.querySelector("code")!;
    expect(code).toHaveAttribute("data-line-numbers");
    // The numbers are CSS content: not in the text a reader selects.
    expect(code.textContent).toBe("onetwothreefour");
    const marked = [...container.querySelectorAll("[data-highlighted]")].map((line) => line.getAttribute("data-line"));
    expect(marked).toEqual(["2", "4"]);
  });

  it("toggles wrapping: pressed state, the pre's mode, and no tab stop when nothing scrolls sideways", async () => {
    const user = userEvent.setup();
    const onWrapChange = vi.fn();
    const { container } = render(<CodeBlock code="x" onWrapChange={onWrapChange} />);
    const pre = container.querySelector("pre")!;
    const toggle = screen.getByRole("button", { name: "Wrap lines" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(pre).toHaveAttribute("tabindex", "0");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(pre).toHaveAttribute("data-wrap");
    expect(pre).not.toHaveAttribute("tabindex");
    expect(onWrapChange).toHaveBeenCalledTimes(1);
    expect(onWrapChange).toHaveBeenCalledWith(true);
  });

  it("follows a controlled wrap and leaves the decision to the caller", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [wrap, setWrap] = useState(true);
      return (
        <>
          <span data-testid="state">{String(wrap)}</span>
          <CodeBlock code="x" wrap={wrap} onWrapChange={setWrap} />
        </>
      );
    }
    const { container } = render(<Controlled />);
    expect(container.querySelector("pre")).toHaveAttribute("data-wrap");
    await user.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(screen.getByTestId("state")).toHaveTextContent("false");
    expect(container.querySelector("pre")).not.toHaveAttribute("data-wrap");
  });

  it("copies the source exactly as given", async () => {
    const user = userEvent.setup();
    render(<CodeBlock code={"line 1\r\nline 2\n"} filename="setup.sh" language="bash" />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(await navigator.clipboard.readText()).toBe("line 1\r\nline 2\n");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("is a group named by its filename and shows the language", () => {
    render(<CodeBlock code="x" filename="src/very/long/path/index.ts" language="ts" />);
    const group = screen.getByRole("group", { name: "src/very/long/path/index.ts" });
    expect(within(group).getByText("ts")).toBeInTheDocument();
  });

  it("is no group without a name, and a caller's aria-label names it", () => {
    const { rerender } = render(<CodeBlock code="x" />);
    expect(screen.queryByRole("group")).toBeNull();
    rerender(<CodeBlock code="x" aria-label="Install command" />);
    expect(screen.getByRole("group", { name: "Install command" })).toBeInTheDocument();
  });

  it("an empty block keeps one line and offers nothing to copy", () => {
    const { container } = render(<CodeBlock code="" />);
    expect(container.querySelectorAll("[data-line]")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Copy code" })).toBeDisabled();
  });

  it("drops the header when there is nothing to put in it", () => {
    const { container } = render(<CodeBlock code="x" copyable={false} wrapToggle={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe("PRE");
  });

  it("is a UI island inside prose and merges the caller's classes", () => {
    const { container } = render(<CodeBlock code="x" className="mt-r2" classNames={{ pre: "max-h-chart" }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-not-prose");
    expect(root).toHaveClass("mt-r2", "bg-surface-1");
    expect(container.querySelector("pre")).toHaveClass("max-h-chart", "font-mono");
  });

  it("names its controls in the caller's language", () => {
    render(<CodeBlock code="x" labels={{ copy: "Code kopieren", wrap: "Zeilen umbrechen" }} />);
    expect(screen.getByRole("button", { name: "Code kopieren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zeilen umbrechen" })).toBeInTheDocument();
  });
});
