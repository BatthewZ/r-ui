import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Grid } from "./Grid";

describe("Grid", () => {
  it("auto-fits at the medium column floor by default, inside its own size container", () => {
    render(<Grid data-testid="g" />);
    const grid = screen.getByTestId("g");
    expect(grid).toHaveClass("grid", "gap-r3", "r-layout-grid-fit-md");
    expect(grid.parentElement).toHaveClass("@container");
  });

  it("takes another column floor", () => {
    render(<Grid minColumn="lg" data-testid="g" />);
    expect(screen.getByTestId("g")).toHaveClass("r-layout-grid-fit-lg");
    expect(screen.getByTestId("g")).not.toHaveClass("r-layout-grid-fit-md");
  });

  it("a fixed count replaces auto-fit", () => {
    render(<Grid columns={3} data-testid="g" />);
    const grid = screen.getByTestId("g");
    expect(grid).toHaveClass("grid-cols-3");
    expect(grid).not.toHaveClass("r-layout-grid-fit-md");
    expect([...grid.classList].filter((c) => c.startsWith("r-layout-grid-fit"))).toEqual([]);
  });

  it("maps counts per container size to container-query classes", () => {
    render(<Grid columns={{ base: 1, "@md": 2, "@3xl": 4 }} data-testid="g" />);
    const grid = screen.getByTestId("g");
    expect(grid).toHaveClass("grid-cols-1", "@md:grid-cols-2", "@3xl:grid-cols-4");
    expect(grid).not.toHaveClass("r-layout-grid-fit-md");
    expect([...grid.classList].filter((c) => c.startsWith("r-layout-grid-fit"))).toEqual([]);
  });

  it("puts `as`, props and className on the grid; classNames.container on the wrapper", () => {
    render(
      <Grid as="ul" aria-label="Services" className="mt-r2" classNames={{ container: "mb-r1" }}>
        <li>a</li>
      </Grid>,
    );
    const list = screen.getByRole("list", { name: "Services" });
    expect(list).toHaveClass("grid", "mt-r2");
    expect(list.parentElement).toHaveClass("@container", "mb-r1");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("takes a separate row gap", () => {
    render(<Grid gap="r2" rowGap="r1" data-testid="g" />);
    expect(screen.getByTestId("g")).toHaveClass("gap-r2", "gap-y-r1");
  });
});
