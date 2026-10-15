import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stack } from "./Stack";

describe("Stack", () => {
  it("is a column with the default r3 gap", () => {
    render(<Stack data-testid="s">x</Stack>);
    const el = screen.getByTestId("s");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("flex", "flex-col", "gap-r3", "items-stretch");
  });

  it("takes a scale step, alignment and an element", () => {
    render(
      <Stack as="ul" gap="r1" align="center" justify="between" data-testid="s">
        <li>a</li>
      </Stack>,
    );
    const el = screen.getByTestId("s");
    expect(el.tagName).toBe("UL");
    expect(el).toHaveClass("gap-r1", "items-center", "justify-between");
    expect(el).not.toHaveClass("gap-r3");
  });

  it("a caller's utility beats the component's, and other classes survive", () => {
    render(<Stack gap="r2" className="gap-r6 mt-r1" data-testid="s" />);
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("gap-r6", "mt-r1", "flex-col");
    expect(el).not.toHaveClass("gap-r2");
  });

  it("forwards a ref to the element", () => {
    let node: HTMLElement | null = null;
    render(<Stack as="section" ref={(el: HTMLElement | null) => {
          node = el;
        }} />);
    expect(node).toBeInstanceOf(HTMLElement);
    expect(node!.tagName).toBe("SECTION");
  });
});
