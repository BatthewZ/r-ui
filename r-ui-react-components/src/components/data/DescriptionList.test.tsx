import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DescriptionList } from "./DescriptionList";

describe("DescriptionList", () => {
  it("pairs each term with its details", () => {
    render(
      <DescriptionList>
        <DescriptionList.Item term="Region">eu-west-1</DescriptionList.Item>
        <DescriptionList.Item term="Owner">—</DescriptionList.Item>
      </DescriptionList>,
    );
    const terms = screen.getAllByRole("term");
    const details = screen.getAllByRole("definition");
    expect(terms.map((t) => t.textContent)).toEqual(["Region", "Owner"]);
    expect(details.map((d) => d.textContent)).toEqual(["eu-west-1", "—"]);
    expect(terms[0]?.closest("dl")).toBe(details[0]?.closest("dl"));
  });

  it("is a named size container; divided draws hairlines between items", () => {
    const { container } = render(
      <DescriptionList variant="divided" className="gap-r2">
        <DescriptionList.Item term="A">1</DescriptionList.Item>
      </DescriptionList>,
    );
    const dl = container.querySelector("dl");
    expect(dl).toHaveClass("@container/dl", "gap-r2");
    expect(dl).toHaveAttribute("data-variant", "divided");
    expect(screen.getByRole("term").parentElement).toHaveClass("@sm/dl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]");
  });

  it("breaks an unbroken word in the term as well as the value, so neither overlaps the other", () => {
    render(
      <DescriptionList>
        <DescriptionList.Item term="Donaudampfschifffahrtsgesellschaft">wraps</DescriptionList.Item>
      </DescriptionList>,
    );
    expect(screen.getByRole("term")).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
    expect(screen.getByRole("definition")).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
  });
});
