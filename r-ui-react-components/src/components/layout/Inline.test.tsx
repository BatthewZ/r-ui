import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Inline } from "./Inline";

describe("Inline", () => {
  it("is a wrapping row, centred, with the default r4 gap", () => {
    render(<Inline data-testid="i" />);
    expect(screen.getByTestId("i")).toHaveClass("flex", "flex-wrap", "gap-r4", "items-center", "justify-start");
  });

  it("takes gap, row gap, alignment, distribution and no-wrap", () => {
    render(<Inline gap="r2" rowGap="r5" align="baseline" justify="end" wrap={false} data-testid="i" />);
    const el = screen.getByTestId("i");
    expect(el).toHaveClass("gap-r2", "gap-y-r5", "items-baseline", "justify-end", "flex-nowrap");
    expect(el).not.toHaveClass("flex-wrap");
  });

  it("renders the element it is given, with its own props", () => {
    render(
      <Inline as="nav" aria-label="Filters">
        x
      </Inline>,
    );
    expect(screen.getByRole("navigation", { name: "Filters" })).toHaveClass("flex");
  });
});
