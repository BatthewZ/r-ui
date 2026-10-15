import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Section } from "./Section";

describe("Section", () => {
  it("is a <section> with the largest fluid rhythm by default", () => {
    render(<Section aria-label="Pricing" />);
    const el = screen.getByRole("region", { name: "Pricing" });
    expect(el.tagName).toBe("SECTION");
    expect(el).toHaveClass("py-section-1");
  });

  it("takes a smaller step and the band variant", () => {
    render(<Section padding="section-3" variant="band" data-testid="s" />);
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("py-section-3", "bg-surface-1", "border-y");
    expect(el).not.toHaveClass("py-section-1");
  });

  it("renders the element it is given", () => {
    render(<Section as="footer" data-testid="s" />);
    expect(screen.getByTestId("s").tagName).toBe("FOOTER");
  });
});
