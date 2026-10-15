import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";
import { StatusLabel } from "./StatusLabel";

describe("Badge", () => {
  it("defaults to a neutral subtle chip", () => {
    render(<Badge>Draft</Badge>);
    const badge = screen.getByText("Draft").parentElement;
    expect(badge).toHaveClass("bg-surface-2", "text-fg-secondary", "border-transparent");
  });

  it("solid uses the tone's fill with its own on-pair text", () => {
    render(
      <>
        <Badge tone="error" variant="solid">
          Failed
        </Badge>
        <Badge tone="warning" variant="solid">
          Degraded
        </Badge>
        <Badge tone="neutral" variant="solid">
          v2
        </Badge>
      </>,
    );
    expect(screen.getByText("Failed").parentElement).toHaveClass("bg-status-error", "text-fg-on-error");
    expect(screen.getByText("Degraded").parentElement).toHaveClass("bg-status-warning", "text-fg-on-warning");
    expect(screen.getByText("v2").parentElement).toHaveClass("bg-fg-primary", "text-fg-inverse");
  });

  it("outline draws a mark-coloured edge with text-safe ink, never a fill colour as text", () => {
    render(
      <Badge tone="success" variant="outline">
        Healthy
      </Badge>,
    );
    const badge = screen.getByText("Healthy").parentElement;
    expect(badge).toHaveClass("border-status-success", "text-fg-success");
    expect(badge).not.toHaveClass("border-transparent");
    expect(badge?.className).not.toMatch(/\btext-status-/);
  });

  it("domain tones use the domain triples", () => {
    render(
      <>
        <Badge tone="serious">P1</Badge>
        <Badge tone="stale" variant="outline">
          12 min old
        </Badge>
      </>,
    );
    expect(screen.getByText("P1").parentElement).toHaveClass("bg-status-serious-bg", "text-fg-serious");
    expect(screen.getByText("12 min old").parentElement).toHaveClass("border-status-stale", "text-fg-stale");
  });

  it("solid serious and stale use the domain marks with their on-fill ink", () => {
    render(
      <>
        <Badge tone="serious" variant="solid">
          Escalated
        </Badge>
        <Badge tone="stale" variant="solid">
          Stale
        </Badge>
      </>,
    );
    const serious = screen.getByText("Escalated").parentElement;
    expect(serious).toHaveClass("bg-status-serious", "text-fg-on-serious");
    expect(serious).not.toHaveClass("bg-status-serious-bg");
    expect(screen.getByText("Stale").parentElement).toHaveClass("bg-status-stale", "text-fg-on-stale");
  });

  it("an icon takes the tone's mark on subtle, and inherits the on-text on solid", () => {
    render(
      <>
        <Badge tone="info" icon={<svg data-testid="subtle-icon" />}>
          Beta
        </Badge>
        <Badge tone="info" variant="solid" icon={<svg data-testid="solid-icon" />}>
          New
        </Badge>
      </>,
    );
    const subtle = screen.getByTestId("subtle-icon").parentElement;
    expect(subtle).toHaveClass("text-status-info");
    expect(subtle).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("solid-icon").parentElement).not.toHaveClass("text-status-info");
  });

  it("gives truncatable text its full value as a title", () => {
    render(<Badge>An extremely long category name</Badge>);
    expect(screen.getByText("An extremely long category name")).toHaveAttribute("title", "An extremely long category name");
  });
});

describe("StatusLabel", () => {
  it("pairs a mark-coloured glyph with the visible words", () => {
    render(<StatusLabel tone="error">Payment failed</StatusLabel>);
    const label = screen.getByText("Payment failed");
    const glyph = label.previousElementSibling;
    expect(glyph).toHaveClass("text-status-error");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(glyph?.querySelector("svg")).not.toBeNull();
    expect(label.parentElement).toHaveClass("text-fg-primary");
  });

  it("has a distinct default glyph per tone, so shape (not only hue) differs", () => {
    const tones = ["neutral", "accent", "error", "success", "warning", "info", "serious", "stale"] as const;
    render(
      <>
        {tones.map((t) => (
          <StatusLabel key={t} tone={t}>
            {t}
          </StatusLabel>
        ))}
      </>,
    );
    const shapes = tones.map((t) => screen.getByText(t).previousElementSibling?.querySelector("svg")?.getAttribute("class"));
    expect(shapes.every(Boolean)).toBe(true);
    expect(new Set(shapes).size).toBe(tones.length);
  });

  it("domain tones use the domain marks", () => {
    render(
      <>
        <StatusLabel tone="serious">Serious</StatusLabel>
        <StatusLabel tone="stale">Stale</StatusLabel>
      </>,
    );
    expect(screen.getByText("Serious").previousElementSibling).toHaveClass("text-status-serious");
    expect(screen.getByText("Stale").previousElementSibling).toHaveClass("text-status-stale");
  });

  it("accepts a replacement glyph", () => {
    render(
      <StatusLabel tone="success" icon={<svg data-testid="custom" />}>
        Deployed
      </StatusLabel>,
    );
    expect(screen.getByTestId("custom").parentElement).toHaveClass("text-status-success");
  });
});
