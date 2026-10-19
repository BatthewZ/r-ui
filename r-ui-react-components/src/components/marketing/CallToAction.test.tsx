import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../primitives";
import { CallToAction } from "./CallToAction";

describe("CallToAction", () => {
  it("is a band region named by its title, an h2 on the display scale by default", () => {
    render(
      <CallToAction
        title="Let it explain itself."
        body="Free for one repository."
        actions={
          <>
            <Button>Start free</Button>
            <Button variant="secondary">Book a demo</Button>
          </>
        }
      />,
    );
    const region = screen.getByRole("region", { name: "Let it explain itself." });
    expect(region.tagName).toBe("SECTION");
    // The band: the raised surface edged with hairlines (Section variant="band").
    expect(region).toHaveClass("bg-surface-1", "border-y", "@container");
    expect(screen.getByRole("heading", { level: 2, name: "Let it explain itself." })).toHaveClass("text-display-2");
    const body = screen.getByText("Free for one repository.");
    expect(body.tagName).toBe("P");
    expect(body).toHaveClass("text-prose-1");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("plain drops the band; headingLevel moves the outline only", () => {
    render(<CallToAction title="Quiet" variant="plain" headingLevel={3} />);
    const region = screen.getByRole("region", { name: "Quiet" });
    expect(region).not.toHaveClass("bg-surface-1");
    expect(region).not.toHaveClass("border-y");
    expect(screen.getByRole("heading", { level: 3, name: "Quiet" })).toHaveClass("text-display-2");
  });

  it("reads title, body, actions, then extra content in that order", () => {
    render(
      <CallToAction title="Title" body="Body" actions={<Button>Act</Button>}>
        <form aria-label="Sign up" />
      </CallToAction>,
    );
    const order = [
      screen.getByRole("heading", { name: "Title" }),
      screen.getByText("Body"),
      screen.getByRole("button", { name: "Act" }),
      screen.getByRole("form", { name: "Sign up" }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("stretches extra content (a size container has no width of its own) and keeps it start-aligned", () => {
    render(
      <CallToAction title="T">
        <div data-testid="extra" />
      </CallToAction>,
    );
    const wrapper = screen.getByTestId("extra").parentElement!;
    expect(wrapper).toHaveClass("w-full", "text-start");
  });

  it("stacked centres its text and actions; split is a container-query grid with the text at the start", () => {
    const { rerender } = render(<CallToAction title="T" actions={<Button>Go</Button>} data-testid="cta" />);
    const heading = screen.getByRole("heading", { name: "T" });
    expect(heading.parentElement).toHaveClass("items-center", "text-center");
    expect(screen.getByRole("button", { name: "Go" }).parentElement).toHaveClass("justify-center");
    rerender(<CallToAction title="T" actions={<Button>Go</Button>} layout="split" data-testid="cta" />);
    expect(screen.getByTestId("cta")).toHaveAttribute("data-layout", "split");
    expect(heading.parentElement).toHaveClass("items-start");
    expect(heading.parentElement!.parentElement).toHaveClass("@4xl:grid-cols-2");
    expect(screen.getByRole("button", { name: "Go" }).parentElement).not.toHaveClass("justify-center");
  });

  it("renders no actions column without actions or content", () => {
    const { container } = render(<CallToAction title="Only a title" />);
    expect(container.querySelector(".mt-section-3")).toBeNull();
    expect(screen.getByRole("heading", { name: "Only a title" })).toBeInTheDocument();
  });
});
