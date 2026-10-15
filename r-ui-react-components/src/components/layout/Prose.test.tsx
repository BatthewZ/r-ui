import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Prose } from "./Prose";

describe("Prose", () => {
  it("marks a prose region capped at the reading measure", () => {
    render(<Prose data-testid="p" />);
    expect(screen.getByTestId("p")).toHaveClass("prose", "max-w-measure");
  });

  it("can run uncapped and as another element", () => {
    render(<Prose as="article" measure={false} data-testid="p" />);
    const el = screen.getByTestId("p");
    expect(el.tagName).toBe("ARTICLE");
    expect(el).toHaveClass("prose");
    expect(el).not.toHaveClass("max-w-measure");
  });
});
