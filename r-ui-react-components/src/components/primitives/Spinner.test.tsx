import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("is decoration by default: hidden, no live region", () => {
    const { container } = render(<Spinner />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).toBeNull();
    expect(root?.querySelector("svg")).toHaveClass("animate-spin");
    expect(root).toHaveClass("size-icon");
  });

  it("with a label it is the status, announced in the caller's words", () => {
    render(<Spinner label="Envoi en cours…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Envoi en cours…");
    expect(status).not.toHaveAttribute("aria-hidden");
  });

  it("className resizes it", () => {
    const { container } = render(<Spinner className="size-control" />);
    expect(container.firstElementChild).toHaveClass("size-control");
    expect(container.firstElementChild).not.toHaveClass("size-icon");
  });
});

describe("Skeleton", () => {
  it("is hidden decoration by default", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("text renders one line box per line, the last one shorter, and stops pulsing under reduced motion", () => {
    const { container } = render(<Skeleton lines={3} />);
    const bars = container.querySelectorAll(".r-primitives-skeleton-text");
    expect(bars).toHaveLength(3);
    expect(bars[2]).toHaveClass("w-3/5");
    expect(bars[0]).not.toHaveClass("w-3/5");
    expect(bars[0]).toHaveClass("animate-pulse", "motion-reduce:animate-none", "bg-fg-primary/10");
  });

  it("a single line is full width", () => {
    const { container } = render(<Skeleton />);
    const bars = container.querySelectorAll(".r-primitives-skeleton-text");
    expect(bars).toHaveLength(1);
    expect(bars[0]).not.toHaveClass("w-3/5");
  });

  it("block and circle are one shape the caller can size", () => {
    const { container } = render(
      <>
        <Skeleton shape="block" className="h-chart" data-testid="block" />
        <Skeleton shape="circle" data-testid="circle" />
      </>,
    );
    const block = screen.getByTestId("block");
    expect(block).toHaveClass("h-chart", "animate-pulse");
    expect(block).not.toHaveClass("h-control");
    expect(screen.getByTestId("circle")).toHaveClass("size-control", "rounded-full");
    expect(container.querySelectorAll(".r-primitives-skeleton-text")).toHaveLength(0);
  });

  it("a labelled skeleton is the region's status", () => {
    render(<Skeleton label="Loading profile" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading profile");
  });
});
