import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionHeading } from "./SectionHeading";

describe("SectionHeading", () => {
  it("names its section through titleId: eyebrow, then an h2, then the lead", () => {
    render(
      <section aria-labelledby="features-title">
        <SectionHeading titleId="features-title" eyebrow="Product" title="From merged to explained." lead="It writes the first draft." />
      </section>,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "From merged to explained." });
    expect(screen.getByRole("region", { name: "From merged to explained." })).toContainElement(heading);
    const group = heading.parentElement!;
    expect([...group.children].map((el) => el.textContent)).toEqual(["Product", "From merged to explained.", "It writes the first draft."]);
    expect(group.lastElementChild!.tagName).toBe("P");
  });

  it("renders only what it is given, at the level asked, centred on request, with slots", () => {
    render(
      <SectionHeading
        title="FAQ"
        headingLevel={3}
        align="center"
        className="mt-r1"
        classNames={{ title: "text-display-3" }}
        data-testid="group"
      />,
    );
    const group = screen.getByTestId("group");
    expect(group.children).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3, name: "FAQ" })).toHaveClass("text-display-3");
    expect(screen.getByRole("heading", { level: 3 })).not.toHaveClass("text-display-2");
    expect(group).toHaveClass("items-center", "text-center", "mt-r1");
  });
});
