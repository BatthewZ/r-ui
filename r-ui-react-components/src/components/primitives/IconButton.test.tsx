import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("is named by `label` (aria-label + title) and hides its glyph", () => {
    render(<IconButton label="Settings" icon={<svg data-testid="glyph" />} />);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button).toHaveAttribute("title", "Settings");
    expect(button).toHaveAttribute("type", "button");
    expect(screen.getByTestId("glyph").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("carries the hit-area class and the compact square, ghost by default", () => {
    render(<IconButton label="Close" icon={<svg />} />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveClass("hit-area", "r-primitives-icon-button");
    expect(button).not.toHaveClass("h-control");
    expect(button).not.toHaveClass("size-control");
    expect(button).toHaveClass("text-fg-secondary");
    expect(button).not.toHaveClass("bg-primary");
  });

  it("paints the requested variant", () => {
    render(<IconButton label="Add" icon={<svg />} variant="primary" />);
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("bg-primary", "text-fg-on-primary");
  });

  it("has a danger variant for destructive actions: the error fill, boxed like Button", () => {
    render(<IconButton label="Delete" icon={<svg />} variant="danger" />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("bg-status-error", "text-fg-on-error", "size-control");
  });

  it("takes the control height when it draws a box, so it lines up with Buttons", () => {
    render(
      <>
        <IconButton label="More" icon={<svg />} variant="secondary" />
        <IconButton label="Add" icon={<svg />} variant="primary" />
        <IconButton label="Wide" icon={<svg />} variant="secondary" className="size-row" />
      </>,
    );
    expect(screen.getByRole("button", { name: "More" })).toHaveClass("size-control", "hit-area");
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("size-control");
    // A caller's size still wins.
    const wide = screen.getByRole("button", { name: "Wide" });
    expect(wide).toHaveClass("size-row");
    expect(wide).not.toHaveClass("size-control");
  });

  it("activates by click and keyboard, once each", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Refresh" icon={<svg />} onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Refresh" });
    await userEvent.click(button);
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("works as a toggle through aria-pressed", () => {
    render(<IconButton label="Bold" icon={<svg />} aria-pressed />);
    expect(screen.getByRole("button", { name: "Bold", pressed: true })).toBeInTheDocument();
  });

  it("aria-disabled stays focusable but does not activate", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Delete" icon={<svg />} aria-disabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Delete" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveFocus();
    expect(onClick).toHaveBeenCalledTimes(0);
  });
});
