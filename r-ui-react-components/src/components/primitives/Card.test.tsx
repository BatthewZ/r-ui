import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";
import { Card } from "./Card";

describe("Card", () => {
  it("composes its parts, with the title as a heading at the requested level", () => {
    render(
      <Card data-testid="card">
        <Card.Header>
          <Card.Title as="h2">Revenue</Card.Title>
          <Card.Description>Last 30 days</Card.Description>
          <Card.Actions>
            <Button variant="secondary">Export</Button>
          </Card.Actions>
        </Card.Header>
        <Card.Body>Body</Card.Body>
        <Card.Footer>Footer</Card.Footer>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(within(card).getByRole("heading", { level: 2, name: "Revenue" })).toBeInTheDocument();
    expect(within(card).getByText("Last 30 days").tagName).toBe("P");
    expect(within(card).getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(within(card).getByText("Body")).toBeInTheDocument();
    expect(within(card).getByText("Footer")).toHaveClass("border-t");
  });

  it("defaults the title to h3", () => {
    render(<Card.Title>Users</Card.Title>);
    expect(screen.getByRole("heading", { level: 3, name: "Users" })).toBeInTheDocument();
  });

  it("is a raised, hairlined size container with no shadow", () => {
    render(<Card data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("@container", "bg-surface-0", "border", "border-border");
    expect(card.className).not.toMatch(/\bshadow/);
  });

  it("groups every non-action child of the header into the text column, in order, with the actions after it", () => {
    render(
      <Card>
        <Card.Header data-testid="header">
          <Card.Actions data-testid="actions">
            <Button variant="secondary">Export</Button>
          </Card.Actions>
          <svg data-testid="icon" />
          <Card.Title>Users</Card.Title>
          <Card.Description>Active this week</Card.Description>
        </Card.Header>
        <Card.Footer>Footer</Card.Footer>
      </Card>,
    );
    const header = screen.getByTestId("header");
    const [text, actions, ...rest] = [...header.children];
    expect(rest).toHaveLength(0);
    expect(actions).toBe(screen.getByTestId("actions"));
    // An arbitrary child (Marketing's feature icon) stays with the title instead
    // of being placed in a column of its own.
    expect([...text!.children]).toEqual([
      screen.getByTestId("icon"),
      screen.getByRole("heading", { name: "Users" }),
      screen.getByText("Active this week"),
    ]);
    expect(screen.getByText("Footer")).toHaveClass("mt-auto");
  });

  it("wraps the actions under the text only when they do not fit beside a column-sm text block", () => {
    render(
      <Card.Header data-testid="header">
        <Card.Title>Checkout service image</Card.Title>
        <Card.Actions data-testid="actions" />
      </Card.Header>,
    );
    // A flex line, not a 2-column grid behind a container query: the wrap is
    // decided by content, so a short action stays beside its title.
    expect(screen.getByTestId("header")).toHaveClass("flex", "flex-wrap");
    expect(screen.getByTestId("header").className).not.toMatch(/grid-cols/);
    expect(screen.getByRole("heading").parentElement).toHaveClass("grow", "basis-column-sm", "min-w-0");
    // Bounded: the actions shrink to the header and cap an unbreakable child.
    expect(screen.getByTestId("actions")).toHaveClass("min-w-0", "max-w-full", "flex-wrap", "*:max-w-full");
  });

  it("puts actions alone at the end, with no empty text column", () => {
    render(
      <Card.Header data-testid="header">
        <Card.Actions data-testid="actions" />
      </Card.Header>,
    );
    const header = screen.getByTestId("header");
    expect(header.children).toHaveLength(1);
    expect(header).toHaveClass("justify-end");
  });

  it("breaks an unbroken word in the title and the description", () => {
    render(
      <Card.Header>
        <Card.Title>Title</Card.Title>
        <Card.Description>Description</Card.Description>
      </Card.Header>,
    );
    expect(screen.getByRole("heading")).toHaveClass("min-w-0", "break-words");
    expect(screen.getByText("Description")).toHaveClass("min-w-0", "break-words");
  });

  it("passes data-density through, so a card can be compact inside a comfortable page", () => {
    render(<Card data-testid="card" data-density="compact" />);
    expect(screen.getByTestId("card")).toHaveAttribute("data-density", "compact");
  });

  it("lets className beat the card's own padding", () => {
    render(<Card data-testid="card" className="p-r1" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("p-r1");
    expect(card).not.toHaveClass("py-r2");
  });
});
