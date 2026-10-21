import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Container } from "./Container";

describe("Container", () => {
  it("caps at the page width with the fluid gutter by default", () => {
    render(<Container data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("r-layout-container", "r-layout-container-page", "px-gutter");
  });

  it("caps at the reading measure, or not at all", () => {
    const { rerender } = render(<Container width="measure" data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("r-layout-container-measure");
    expect(screen.getByTestId("c")).not.toHaveClass("r-layout-container-page");
    rerender(<Container width="full" data-testid="c" />);
    expect(screen.getByTestId("c").className).not.toMatch(/r-layout-container-(page|measure)/);
  });

  // The cap grows by the gutters only where px-gutter pads by them; the sizes
  // themselves are layout-container.js's (jsdom lays nothing out).
  it("widens its cap by the gutters only when it pads by the gutter", () => {
    const { rerender } = render(<Container data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("r-layout-container-gutter", "px-gutter");
    rerender(<Container gutter={false} data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("r-layout-container");
    expect(screen.getByTestId("c")).not.toHaveClass("px-gutter");
    expect(screen.getByTestId("c")).not.toHaveClass("r-layout-container-gutter");
  });

  it("renders the element it is given", () => {
    render(<Container as="main">x</Container>);
    expect(screen.getByRole("main")).toHaveClass("r-layout-container");
  });
});
