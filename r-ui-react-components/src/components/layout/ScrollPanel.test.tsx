import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ScrollPanel } from "./ScrollPanel";

function Panel({ onSubmit }: { onSubmit?: () => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <ScrollPanel data-testid="panel" className="max-h-[calc(var(--CONTROL-H)*6)]">
        <ScrollPanel.Body data-testid="body" tabIndex={0} role="region" aria-label="Settings">
          <label>
            Name <input name="name" defaultValue="Ops" />
          </label>
        </ScrollPanel.Body>
        <ScrollPanel.Footer data-testid="footer">
          <button type="submit">Save</button>
        </ScrollPanel.Footer>
      </ScrollPanel>
    </form>
  );
}

describe("ScrollPanel", () => {
  it("scrolls the body alone: the footer is the panel's, never inside the scroller", () => {
    render(<Panel />);
    const panel = screen.getByTestId("panel");
    const body = screen.getByTestId("body");
    const footer = screen.getByTestId("footer");
    expect(panel).toHaveClass("flex", "flex-col", "min-h-0");
    expect(body).toHaveClass("overflow-y-auto", "min-h-0", "flex-1");
    expect(footer).toHaveClass("shrink-0", "border-t");
    expect(footer).not.toHaveClass("overflow-y-auto");
    expect(body.contains(footer)).toBe(false);
    expect([...panel.children]).toEqual([body, footer]);
    expect(screen.getByRole("region", { name: "Settings" })).toBe(body);
  });

  it("prints in the flow: the bound and the scroller let go on paper, a caller may say otherwise", () => {
    render(
      <>
        <Panel />
        <ScrollPanel data-testid="kept" data-print="avoid-break" />
      </>,
    );
    expect(screen.getByTestId("panel")).toHaveAttribute("data-print", "flow");
    expect(screen.getByTestId("body")).toHaveAttribute("data-print", "flow");
    expect(screen.getByTestId("kept")).toHaveAttribute("data-print", "avoid-break");
  });

  it("sits inside a form, so the footer's submit sends the body's fields", async () => {
    const onSubmit = vi.fn();
    render(<Panel onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Name" }).closest("form")).toBe(screen.getByRole("button", { name: "Save" }).closest("form"));
  });

  it("a caller's utility beats a part's own", () => {
    render(
      <ScrollPanel>
        <ScrollPanel.Body data-testid="b" className="p-r1" />
        <ScrollPanel.Footer data-testid="f" className="px-r2" />
      </ScrollPanel>,
    );
    expect(screen.getByTestId("b")).toHaveClass("p-r1");
    expect(screen.getByTestId("b")).not.toHaveClass("p-r3");
    expect(screen.getByTestId("f")).toHaveClass("px-r2", "py-r4");
    expect(screen.getByTestId("f")).not.toHaveClass("px-r3");
  });
});
