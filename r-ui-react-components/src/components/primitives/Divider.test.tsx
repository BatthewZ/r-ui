import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Divider } from "./Divider";
import { Kbd } from "./Kbd";

describe("Divider", () => {
  it("horizontal is a separator hairline", () => {
    render(<Divider />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveClass("h-px", "bg-border");
    expect(sep).not.toHaveAttribute("aria-orientation", "vertical");
  });

  it("vertical declares its orientation and stretches", () => {
    render(<Divider orientation="vertical" />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-orientation", "vertical");
    expect(sep).toHaveClass("w-px", "self-stretch");
  });

  it("a labelled divider keeps its label readable (no presentational separator role)", () => {
    const { container } = render(<Divider>or continue with</Divider>);
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.getByText("or continue with")).toBeVisible();
    expect(container.querySelectorAll('[aria-hidden="true"].bg-border')).toHaveLength(2);
  });
});

describe("Kbd", () => {
  it("renders a <kbd> key cap", () => {
    render(<Kbd>Esc</Kbd>);
    const key = screen.getByText("Esc");
    expect(key.tagName).toBe("KBD");
    expect(key).toHaveClass("font-mono", "text-body-3");
  });
});
