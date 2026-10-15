import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Container } from "./Container";

describe("Container", () => {
  it("caps at the page width with the fluid gutter by default", () => {
    render(<Container data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("r-layout-container", "max-w-page", "px-gutter");
  });

  it("caps at the reading measure, or not at all", () => {
    const { rerender } = render(<Container width="measure" data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("max-w-measure");
    expect(screen.getByTestId("c")).not.toHaveClass("max-w-page");
    rerender(<Container width="full" data-testid="c" />);
    expect(screen.getByTestId("c").className).not.toMatch(/max-w-(page|measure)/);
  });

  it("drops the gutter on request", () => {
    render(<Container gutter={false} data-testid="c" />);
    expect(screen.getByTestId("c")).not.toHaveClass("px-gutter");
  });

  it("renders the element it is given", () => {
    render(<Container as="main">x</Container>);
    expect(screen.getByRole("main")).toHaveClass("r-layout-container");
  });
});
