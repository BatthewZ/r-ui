import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HoverCardSection from "../sections/overlays/HoverCard";
import SplitterSection from "../sections/layout/Splitter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the HoverCard and Splitter demos", () => {
  it("render without a React warning (a card's div inside a <p> would be one)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <HoverCardSection />
        <SplitterSection />
      </>,
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("the Splitter section renders seven splitters with every separator named after its pane", () => {
    const { container } = render(<SplitterSection />);
    expect(container.querySelectorAll(".r-layout-splitter")).toHaveLength(7);
    const mail = within(screen.getByTestId("sp-mail"));
    expect(mail.getAllByRole("separator").map((s) => s.getAttribute("aria-label"))).toEqual(["Resize Folders", "Resize Messages"]);
    expect(within(screen.getByTestId("sp-editor")).getByRole("separator")).toHaveAccessibleName("Resize Preview");
    expect(within(screen.getByTestId("sp-nested")).getAllByRole("separator").map((s) => s.getAttribute("aria-label"))).toEqual([
      "Resize Explorer",
      "Resize Terminal",
    ]);
  });

  it("the HoverCard section's triggers are links with their own hrefs, and the table offers a toggle per author", () => {
    render(<HoverCardSection />);
    expect(screen.getByTestId("hc-ada")).toHaveAttribute("href", "#/overview/overlays-hovercard/ada");
    expect(within(screen.getByTestId("hc-table")).getAllByRole("button", { name: /^Preview @/ })).toHaveLength(3);
  });
});
