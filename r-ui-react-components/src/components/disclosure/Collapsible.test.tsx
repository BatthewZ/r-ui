import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Collapsible } from "./Collapsible";

function Details(props: Parameters<typeof Collapsible>[0]) {
  return (
    <Collapsible {...props}>
      <Collapsible.Trigger>Advanced</Collapsible.Trigger>
      <Collapsible.Content>
        <label>
          Retries <input />
        </label>
      </Collapsible.Content>
    </Collapsible>
  );
}

describe("Collapsible", () => {
  it("is a button that controls its region, closed by default and inert while closed", () => {
    render(<Details />);
    const trigger = screen.getByRole("button", { name: "Advanced" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const content = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    expect(content).toHaveAttribute("data-state", "closed");
    expect(content).toHaveAttribute("inert");
    expect(content).toContainElement(screen.getByRole("textbox", { hidden: true }));
  });

  it("toggles on press and keyboard, and its content becomes reachable", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Details onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Advanced" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Retries" })).toHaveFocus();
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("controlled: open decides; a press only proposes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Details open onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Advanced" });
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("disabled: the trigger is disabled and nothing toggles", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Details disabled onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Advanced" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledTimes(0);
  });

  it("the root reports its state for styling", async () => {
    const user = userEvent.setup();
    const { container } = render(<Details data-testid="root" />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("data-state", "closed");
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect(root).toHaveAttribute("data-state", "open");
  });
});
