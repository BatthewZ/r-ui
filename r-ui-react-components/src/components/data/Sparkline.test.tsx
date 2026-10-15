import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("is an image named by its label and a low/high/latest summary", () => {
    render(<Sparkline label="Requests, 24h" values={[3, 9, 1, 4.25]} />);
    expect(screen.getByRole("img", { name: "Requests, 24h: low 1, high 9, latest 4.3" })).toBeInTheDocument();
  });

  it("takes a custom summary and formatter", () => {
    const { rerender } = render(<Sparkline label="Errors" summary="falling all day" values={[5, 4, 2]} />);
    expect(screen.getByRole("img", { name: "Errors: falling all day" })).toBeInTheDocument();
    rerender(<Sparkline label="Errors" format={(v) => `${v}%`} values={[5, 4, 2]} />);
    expect(screen.getByRole("img", { name: "Errors: low 2%, high 5%, latest 2%" })).toBeInTheDocument();
  });

  it("breaks the line at a gap instead of drawing through zero", () => {
    const { container } = render(<Sparkline label="Gappy" values={[1, 2, null, 4, 5]} />);
    const line = container.querySelector("path");
    expect(line?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    expect(screen.getByRole("img")).toHaveAccessibleName("Gappy: low 1, high 5, latest 5");
  });

  it("draws a span wider than a double can hold without a NaN in any path", () => {
    const { container } = render(<Sparkline label="Hostile" values={[1e308, -1e308, 0]} />);
    const paths = Array.from(container.querySelectorAll("path"), (p) => p.getAttribute("d") ?? "");
    expect(paths).toHaveLength(3);
    expect(paths[0]).toBe("M3.00,3.00L50.00,29.00L97.00,16.00");
    for (const d of paths) expect(d).not.toMatch(/NaN|Infinity/);
  });

  it("says when there is no data and draws no point", () => {
    const { container } = render(<Sparkline label="Empty" values={[]} />);
    expect(screen.getByRole("img", { name: "Empty: no data" })).toBeInTheDocument();
    expect(container.querySelector("[data-sparkline-point]")).toBeNull();
  });

  it("marks the latest point, and not when the latest value is missing", () => {
    const { container, rerender } = render(<Sparkline label="x" values={[1, 2, 3]} />);
    expect(container.querySelector("[data-sparkline-point]")).not.toBeNull();
    rerender(<Sparkline label="x" values={[1, 2, null]} />);
    expect(container.querySelector("[data-sparkline-point]")).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName("x: low 1, high 2, latest no data");
  });

  it("draws a total line in the primary ink, not a series colour", () => {
    render(<Sparkline label="All regions" series="total" values={[3, 5, 4]} />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveClass("stroke-fg-primary");
    expect(svg.getAttribute("class")).not.toMatch(/stroke-series-/);
  });

  it("strokes in the entity's series colour, and className merges last", () => {
    render(<Sparkline label="x" series={3} values={[1, 2]} className="h-r1" />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveClass("stroke-series-3", "h-r1");
    expect(svg).not.toHaveClass("stroke-series-1");
    expect(svg).not.toHaveClass("h-spark");
  });

  it("takes its height from the density-selected sparkline token", () => {
    render(<Sparkline label="x" values={[1, 2]} />);
    expect(screen.getByRole("img")).toHaveClass("h-spark");
  });
});
