import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Parallax } from "./Parallax";

describe("Parallax", () => {
  it("is a decorative box: hidden from assistive tech, inert, its children in the drifting layer", () => {
    render(
      <section aria-label="Hero">
        <Parallax data-testid="p" className="absolute inset-0">
          <img src="/fjord.svg" alt="" />
        </Parallax>
        <h2>Ship faster</h2>
      </section>,
    );
    const box = screen.getByTestId("p");
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveAttribute("inert");
    expect(box).toHaveClass("r-motion-parallax", "absolute", "inset-0");
    const layer = box.querySelector(":scope > .r-motion-parallax-layer");
    expect(layer?.querySelector("img")).not.toBeNull();
    // The section's own content stays outside it, readable.
    expect(screen.getByRole("heading", { name: "Ship faster" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps it hidden even when a caller's props try to expose it", () => {
    const exposing = { "aria-hidden": false, inert: false } as unknown as Record<string, never>;
    render(<Parallax data-testid="p" {...exposing} />);
    const box = screen.getByTestId("p");
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveAttribute("inert");
  });

  it("names its strength for the stylesheet (medium unless asked) and styles the layer slot", () => {
    const { rerender } = render(<Parallax data-testid="p" classNames={{ layer: "opacity-disabled" }} />);
    const box = screen.getByTestId("p");
    expect(box).toHaveAttribute("data-strength", "medium");
    expect(box.querySelector(".r-motion-parallax-layer")).toHaveClass("opacity-disabled");
    rerender(<Parallax data-testid="p" strength="subtle" />);
    expect(box).toHaveAttribute("data-strength", "subtle");
  });

  it("needs no script: the server markup is the whole component", () => {
    const html = renderToString(
      <Parallax strength="strong">
        <span className="size-full" />
      </Parallax>,
    );
    expect(html).toBe(
      '<div aria-hidden="true" inert="" data-strength="strong" class="r-motion-parallax"><div class="r-motion-parallax-layer"><span class="size-full"></span></div></div>',
    );
  });
});
