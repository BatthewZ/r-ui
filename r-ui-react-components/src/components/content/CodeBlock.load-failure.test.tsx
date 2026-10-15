import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeBlock } from "./CodeBlock";
import { loadHighlighter } from "./code-highlight";

// The lazy chunk fails (a network error, a deploy that removed the old chunk):
// importing lowlight's core throws, as a failed dynamic import does.
vi.mock("lowlight", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("CodeBlock when highlighting fails to load", () => {
  it("renders the plain text and settles off, without an error", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<CodeBlock code={"const answer = 42;\nreturn answer;"} language="ts" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-highlight", "pending");

    await expect(loadHighlighter("ts")).resolves.toBeNull();
    await screen.findByText("const answer = 42;");
    expect(root).toHaveAttribute("data-highlight", "off");
    expect(root.querySelector("[data-token]")).toBeNull();
    expect([...root.querySelectorAll("[data-line]")].map((line) => line.textContent)).toEqual([
      "const answer = 42;",
      "return answer;",
    ]);
    // Copy still works on plain code.
    expect(screen.getByRole("button", { name: "Copy code" })).toBeEnabled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
