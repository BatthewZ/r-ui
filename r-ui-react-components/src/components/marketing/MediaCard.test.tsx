import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, forwardRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { RouterProvider } from "../../util/router";
import { IconButton } from "../primitives";
import { MediaCard } from "./MediaCard";

const IMAGE = { src: "/cover.jpg", alt: "A kiln at night", width: 1600, height: 900 };

describe("MediaCard", () => {
  it("is one link named by its title, inside a heading", () => {
    render(
      <MediaCard
        href="/journal/changelogs"
        title="Nobody reads your changelog"
        description="Three habits of the notes people read."
        meta="Maya Okafor · 8 min"
        image={IMAGE}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Nobody reads your changelog");
    expect(links[0]).toHaveAttribute("href", "/journal/changelogs");
    // The stretched-link class is what covers the card.
    expect(links[0]).toHaveClass("r-marketing-media-card-link");
    expect(screen.getByRole("heading", { level: 3 })).toContainElement(links[0]!);
  });

  it("has exactly two tab stops with one secondary action: the card link, then the action", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MediaCard
        href="/a"
        title="Card"
        meta="Meta"
        actions={<IconButton label="Save for later" icon={<span />} onClick={onSave} />}
      />,
    );
    await user.tab();
    expect(screen.getByRole("link", { name: "Card" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Save for later" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("renders the actions after the link, in their positioned layer", () => {
    render(<MediaCard href="/a" title="Card" actions={<button type="button">Share</button>} />);
    const link = screen.getByRole("link");
    const share = screen.getByRole("button", { name: "Share" });
    expect(link.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(share.parentElement).toHaveClass("r-marketing-media-card-actions");
  });

  it("loads the image lazily with its intrinsic size, inside a ratio box", () => {
    render(<MediaCard href="/a" title="Card" image={IMAGE} ratio="square" />);
    const img = screen.getByRole("img", { name: "A kiln at night" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "900");
    expect(img.parentElement).toHaveClass("aspect-square");
    expect(img.parentElement).not.toHaveClass("aspect-video");
  });

  it("defaults to the wide ratio", () => {
    render(<MediaCard href="/a" title="Card" image={IMAGE} />);
    expect(screen.getByRole("img").parentElement).toHaveClass("aspect-video");
  });

  it("shows a decorative placeholder with no image, and when the image fails", () => {
    const { container, rerender } = render(<MediaCard href="/a" title="Card" />);
    expect(container.querySelector(".r-marketing-media-card-placeholder")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();

    rerender(<MediaCard href="/a" title="Card" image={IMAGE} />);
    const img = screen.getByRole("img", { name: "A kiln at night" });
    expect(container.querySelector(".r-marketing-media-card-placeholder")).toBeNull();
    fireEvent.error(img);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".r-marketing-media-card-placeholder")).not.toBeNull();

    // A new image gets its own try.
    rerender(<MediaCard href="/a" title="Card" image={{ ...IMAGE, src: "/other.jpg" }} />);
    expect(screen.getByRole("img", { name: "A kiln at night" })).toHaveAttribute("src", "/other.jpg");
  });

  it("puts the badge in the media box", () => {
    render(<MediaCard href="/a" title="Card" badge={<span>Guide</span>} />);
    expect(screen.getByText("Guide").closest(".r-marketing-media-card-media")).not.toBeNull();
  });

  it("refuses a script URL: the title renders as text, not a link", () => {
    render(<MediaCard href="javascript:alert(1)" title="Card" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Card" })).toBeInTheDocument();
  });

  it("renders an internal link through the router, and an external one as <a>", () => {
    const RouterLink = forwardRef<HTMLAnchorElement, ComponentProps<"a">>(function RouterLink(props, ref) {
      return <a ref={ref} data-router="" {...props} />;
    });
    render(
      <RouterProvider link={RouterLink}>
        <MediaCard href="/journal" title="Inside" />
        <MediaCard href="https://example.com" title="Outside" />
      </RouterProvider>,
    );
    expect(screen.getByRole("link", { name: "Inside" })).toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "Outside" })).not.toHaveAttribute("data-router");
  });

  it("takes a title level", () => {
    render(<MediaCard href="/a" title="Card" titleAs="h2" />);
    expect(screen.getByRole("heading", { level: 2, name: "Card" })).toBeInTheDocument();
  });

  describe("Skeleton", () => {
    it("announces once when labelled, and is decoration otherwise", () => {
      const { rerender } = render(<MediaCard.Skeleton label="Loading articles" />);
      expect(screen.getByRole("status")).toHaveTextContent("Loading articles");
      rerender(<MediaCard.Skeleton />);
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("keeps the card's ratio box", () => {
      const { container } = render(<MediaCard.Skeleton ratio="portrait" />);
      expect(container.querySelector(".r-marketing-media-card-media")).toHaveClass("aspect-3/4");
    });
  });
});
