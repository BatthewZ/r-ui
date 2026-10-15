import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows a title, description and actions; the title is not a heading by default", () => {
    render(
      <EmptyState
        icon={<svg data-testid="icon" />}
        title="No deploys yet"
        description="Deploys appear here."
        actions={<button type="button">New deploy</button>}
      />,
    );
    expect(screen.getByText("No deploys yet").tagName).toBe("P");
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Deploys appear here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New deploy" })).toBeInTheDocument();
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the title as a heading at the given level", () => {
    render(<EmptyState title="Nothing here" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Nothing here" })).toBeInTheDocument();
  });

  it("tints the icon for an error", () => {
    render(<EmptyState tone="error" icon={<svg data-testid="icon" />} title="Failed" />);
    expect(screen.getByTestId("icon").parentElement).toHaveClass("text-status-error");
  });

  it("omits the parts it was not given", () => {
    const { container } = render(<EmptyState title="Bare" />);
    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});
