import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeatureGrid } from "./FeatureGrid";

const Icon = () => <svg data-testid="icon" />;

describe("FeatureGrid", () => {
  it("is a list of features, each a heading (h3 by default) with its description", () => {
    render(
      <FeatureGrid>
        <FeatureGrid.Item icon={<Icon />} title="Drafts from merges">
          Every merged pull request becomes a line.
        </FeatureGrid.Item>
        <FeatureGrid.Item title="Audiences">Sorted by who it affects.</FeatureGrid.Item>
      </FeatureGrid>,
    );
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("UL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("heading", { level: 3, name: "Drafts from merges" })).toHaveClass("text-display-4");
    expect(within(items[0]!).getByText("Every merged pull request becomes a line.")).toHaveClass("text-prose-3");
    // The icon is decoration in its tile; an item without one renders no tile.
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(items[1]!.querySelector("[aria-hidden]")).toBeNull();
  });

  it("takes a heading level for every item without changing the look", () => {
    render(
      <FeatureGrid headingLevel={4}>
        <FeatureGrid.Item title="One" />
        <FeatureGrid.Item title="Two" />
      </FeatureGrid>,
    );
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    const headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual(["One", "Two"]);
    for (const heading of headings) expect(heading).toHaveClass("text-display-4");
  });

  it("columns follow the grid's own width: one, two from @xl, three from @4xl by default; minColumn auto-fits instead", () => {
    const { rerender } = render(
      <FeatureGrid>
        <FeatureGrid.Item title="A" />
      </FeatureGrid>,
    );
    const list = screen.getByRole("list");
    expect(list).toHaveClass("grid-cols-1", "@xl:grid-cols-2", "@4xl:grid-cols-3");
    // The grid queries the size container wrapped around it, never the viewport.
    expect(list.parentElement).toHaveClass("@container");
    rerender(
      <FeatureGrid minColumn="sm">
        <FeatureGrid.Item title="A" />
      </FeatureGrid>,
    );
    expect(screen.getByRole("list")).toHaveClass("r-layout-grid-fit-sm");
    expect(screen.getByRole("list")).not.toHaveClass("@xl:grid-cols-2");
  });

  it("a linked item is ONE link, named by its title, stretched over the item", () => {
    render(
      <FeatureGrid>
        <FeatureGrid.Item icon={<Icon />} title="Review queue" href="/features/review">
          Nothing ships unread.
        </FeatureGrid.Item>
        <FeatureGrid.Item title="Not linked">Plain.</FeatureGrid.Item>
      </FeatureGrid>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link).toHaveAccessibleName("Review queue");
    expect(link).toHaveAttribute("href", "/features/review");
    // The heading holds the link (not a link around the heading and paragraph).
    expect(link.parentElement).toBe(screen.getByRole("heading", { name: "Review queue" }));
    expect(link).toHaveClass("r-marketing-stretched-link");
    expect(link.closest("li")).toHaveClass("relative");
  });

  it("refuses a script URL: the title stays text, no link", () => {
    render(
      <FeatureGrid>
        <FeatureGrid.Item title="Hostile" href="javascript:alert(1)" />
      </FeatureGrid>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Hostile" })).toBeInTheDocument();
  });

  it("card items carry an edge and a surface, and only linked cards firm the edge on hover", () => {
    render(
      <FeatureGrid variant="card">
        <FeatureGrid.Item title="Linked" href="/x" />
        <FeatureGrid.Item title="Static" />
      </FeatureGrid>,
    );
    const [linked, still] = screen.getAllByRole("listitem") as [HTMLElement, HTMLElement];
    for (const item of [linked, still]) {
      expect(item).toHaveClass("border", "border-border", "bg-surface-0", "rounded-lg");
      expect(item).toHaveAttribute("data-variant", "card");
    }
    expect(linked).toHaveClass("hover:border-border-strong");
    expect(still).not.toHaveClass("hover:border-border-strong");
  });

  it("puts className and props on the list and classNames.container on the size container", () => {
    render(
      <FeatureGrid className="mt-r2" aria-label="Features" classNames={{ container: "max-w-page" }}>
        <FeatureGrid.Item title="A" />
      </FeatureGrid>,
    );
    const list = screen.getByRole("list", { name: "Features" });
    expect(list).toHaveClass("mt-r2");
    expect(list.parentElement).toHaveClass("max-w-page");
  });

  it("an item outside a FeatureGrid says so", () => {
    expect(() => render(<FeatureGrid.Item title="Lost" />)).toThrow(/inside a FeatureGrid/);
  });
});
