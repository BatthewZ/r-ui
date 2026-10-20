import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../primitives";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("is a region named by its title, an h1 on the display scale by default", () => {
    render(<Hero title="Release notes your customers read." lead="Drafted from merged work." />);
    const region = screen.getByRole("region", { name: "Release notes your customers read." });
    expect(region.tagName).toBe("SECTION");
    const heading = screen.getByRole("heading", { level: 1, name: "Release notes your customers read." });
    expect(heading).toHaveClass("text-display-1");
    // The lead is a paragraph on the prose scale, not the display one.
    const lead = screen.getByText("Drafted from merged work.");
    expect(lead.tagName).toBe("P");
    expect(lead).toHaveClass("text-prose-1");
    expect(lead).not.toHaveClass("text-display-1");
  });

  it("takes a heading level for the outline without changing the look", () => {
    render(<Hero title="Inside a page" headingLevel={2} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Inside a page" })).toHaveClass("text-display-1");
  });

  it("renders every slot in reading order: eyebrow, title, lead, actions, extra, media, proof", () => {
    render(
      <Hero
        eyebrow="New"
        title="Title"
        lead="Lead"
        actions={<Button>Start free</Button>}
        media={<img alt="Product" src="x.png" />}
        proof={<p>Trusted by 1,400 teams</p>}
      >
        <p>Extra</p>
      </Hero>,
    );
    const order = ["New", "Title", "Lead", "Start free", "Extra", "Product", "Trusted by 1,400 teams"].map(
      (text) => screen.queryByText(text) ?? screen.getByRole("img", { name: text }),
    );
    for (let i = 1; i < order.length; i++) {
      // Each slot follows the previous one in the document.
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("omits the slots it is not given (no empty wrappers)", () => {
    const { container } = render(<Hero title="Only a title" />);
    expect(container.querySelector(".text-prose-1")).toBeNull();
    expect(container.querySelector(".mt-section-3")).toBeNull();
    expect(container.querySelector(".mt-section-2")).toBeNull();
    // Positive control: the title itself is there.
    expect(screen.getByRole("heading", { name: "Only a title" })).toBeInTheDocument();
  });

  it("stacked centres its text; split is a container-query grid with the text at the start", () => {
    const { rerender } = render(<Hero title="T" media={<span>M</span>} data-testid="hero" />);
    const hero = screen.getByTestId("hero");
    expect(hero).toHaveAttribute("data-layout", "stacked");
    expect(hero).toHaveClass("@container");
    const text = screen.getByRole("heading").parentElement!;
    expect(text).toHaveClass("items-center", "text-center");

    rerender(<Hero title="T" media={<span>M</span>} layout="split" data-testid="hero" />);
    expect(screen.getByTestId("hero")).toHaveAttribute("data-layout", "split");
    const grid = screen.getByRole("heading").parentElement!.parentElement!;
    expect(grid).toHaveClass("grid", "@4xl:grid-cols-2");
    expect(screen.getByRole("heading").parentElement).not.toHaveClass("text-center");
  });

  it("band is the raised surface with hairlines; a caller's class still wins", () => {
    render(<Hero title="T" variant="band" className="py-section-3" data-testid="hero" />);
    const hero = screen.getByTestId("hero");
    expect(hero).toHaveClass("bg-surface-1", "border-y", "py-section-3");
    expect(hero).not.toHaveClass("py-section-1");
  });

  it("puts a backdrop in a hidden, inert, unprinted layer under the content", () => {
    render(
      <Hero
        title="Layered"
        actions={<Button>Start free</Button>}
        backdrop={<img alt="Contours" src="x.svg" />}
        classNames={{ backdrop: "sc-x-backdrop" }}
        data-testid="hero"
      />,
    );
    const hero = screen.getByTestId("hero");
    const layer = hero.querySelector(".r-marketing-hero-backdrop")!;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveAttribute("inert");
    expect(layer).toHaveAttribute("data-print", "hide");
    expect(layer).toHaveClass("sc-x-backdrop");
    // Out of the accessibility tree: the picture is not an image to assistive tech.
    expect(screen.queryByRole("img", { name: "Contours" })).toBeNull();
    expect(layer.querySelector("img")).toBeInTheDocument();
    // The layer comes first and the hero positions it; the content after it is positioned
    // too, so paint order lifts it over the layer. The region keeps its name and its button.
    expect(hero.firstElementChild).toBe(layer);
    expect(hero).toHaveClass("relative");
    expect(layer.nextElementSibling).toHaveClass("relative");
    expect(screen.getByRole("region", { name: "Layered" })).toBe(hero);
    expect(screen.getByRole("button", { name: "Start free" })).toBeInTheDocument();
  });

  it("without a backdrop renders no layer and positions nothing", () => {
    render(<Hero title="Flat" data-testid="hero" />);
    const hero = screen.getByTestId("hero");
    expect(hero.querySelector(".r-marketing-hero-backdrop")).toBeNull();
    expect(hero).not.toHaveClass("relative");
    expect(hero.firstElementChild).not.toHaveClass("relative");
  });

  it("reaches every internal through classNames", () => {
    render(
      <Hero
        title="T"
        eyebrow="E"
        lead="L"
        actions={<span>A</span>}
        proof={<span>P</span>}
        classNames={{ title: "sc-x-title", eyebrow: "sc-x-eyebrow", lead: "sc-x-lead", actions: "sc-x-actions", proof: "sc-x-proof" }}
      />,
    );
    expect(screen.getByRole("heading")).toHaveClass("sc-x-title");
    expect(screen.getByText("E")).toHaveClass("sc-x-eyebrow");
    expect(screen.getByText("L")).toHaveClass("sc-x-lead");
    expect(screen.getByText("A").parentElement).toHaveClass("sc-x-actions");
    expect(screen.getByText("P").parentElement).toHaveClass("sc-x-proof");
  });
});
