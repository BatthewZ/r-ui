import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubPopover } from "./overlay-stubs.test.helpers";
import { Popover } from "./Popover";
import { Tooltip } from "./Tooltip";

function Filters({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <>
      <Popover onOpenChange={onOpenChange}>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Content aria-label="Filters">
          <label>
            Owner <input />
          </label>
          <Popover.Close>Done</Popover.Close>
        </Popover.Content>
      </Popover>
      <p>Outside</p>
    </>
  );
}

describe("Popover", () => {
  it("opens a non-modal dialog wired to its trigger and moves focus into it", async () => {
    const user = userEvent.setup();
    render(<Filters />);
    const trigger = screen.getByRole("button", { name: "Filters" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    const panel = screen.getByRole("dialog", { name: "Filters" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Owner" })).toHaveFocus());
  });

  it("with no name of its own, the panel is named by its trigger (a caller's trigger id included)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover>
          <Popover.Trigger>Share</Popover.Trigger>
          <Popover.Content>
            <input aria-label="Email" />
          </Popover.Content>
        </Popover>
        <Popover>
          <Popover.Trigger id="export-trigger">Export</Popover.Trigger>
          <Popover.Content>
            <input aria-label="File name" />
          </Popover.Content>
        </Popover>
      </>
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    const share = screen.getByRole("dialog", { name: "Share" });
    expect(share).toHaveAttribute("aria-labelledby", screen.getByRole("button", { name: "Share" }).id);

    const exportTrigger = screen.getByRole("button", { name: "Export" });
    expect(exportTrigger).toHaveAttribute("id", "export-trigger");
    await user.click(exportTrigger);
    expect(screen.getByRole("dialog", { name: "Export" })).toHaveAttribute("aria-labelledby", "export-trigger");
  });

  it("a caller's aria-label or aria-labelledby names the panel instead", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover>
          <Popover.Trigger>Filters</Popover.Trigger>
          <Popover.Content aria-label="Incident filters">
            <input aria-label="Owner" />
          </Popover.Content>
        </Popover>
        <Popover>
          <Popover.Trigger>Help</Popover.Trigger>
          <Popover.Content aria-labelledby="help-heading">
            <h2 id="help-heading">Keyboard shortcuts</h2>
          </Popover.Content>
        </Popover>
      </>
    );
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const filters = screen.getByRole("dialog", { name: "Incident filters" });
    expect(filters).not.toHaveAttribute("aria-labelledby");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("Close closes it and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Filters onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("Escape closes it and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Filters />);
    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("a press outside closes it (light dismiss)", async () => {
    const user = userEvent.setup();
    render(<Filters />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByText("Outside"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a press inside does not close it", async () => {
    const user = userEvent.setup();
    render(<Filters />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("textbox"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape on a tooltip inside it closes only the tooltip", async () => {
    const user = userEvent.setup();
    render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Panel">
          <Tooltip content="More about this">
            <button type="button">Info</button>
          </Tooltip>
        </Popover.Content>
      </Popover>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Info" })).toHaveFocus());
    // Focus came from script, not the keyboard: re-focus by Tab to open the tooltip.
    await user.tab({ shift: true });
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Panel" })).toBeInTheDocument();
  });

  it("controlled: follows the open prop and reports requests", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Panel">Body</Popover.Content>
      </Popover>
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <Popover open onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Panel">Body</Popover.Content>
      </Popover>
    );
    expect(screen.getByRole("dialog", { name: "Panel" })).toBeInTheDocument();
  });

  it("draws an arrow only when asked", async () => {
    const { rerender } = render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Panel">Body</Popover.Content>
      </Popover>
    );
    expect(screen.getByRole("dialog").querySelector(".r-overlays-arrow")).toBeNull();
    rerender(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Panel" arrow>
          Body
        </Popover.Content>
      </Popover>
    );
    const arrow = screen.getByRole("dialog").querySelector(".r-overlays-arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow).toHaveAttribute("data-side", "top");
  });

  it("renders in place inside a clipping ancestor and asks for the top layer", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      render(
        <div data-testid="clip" style={{ overflow: "hidden" }}>
          <Popover>
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Content aria-label="Panel">Body</Popover.Content>
          </Popover>
        </div>
      );
      await user.click(screen.getByRole("button", { name: "Open" }));
      const panel = screen.getByRole("dialog", { hidden: true });
      expect(screen.getByTestId("clip")).toContainElement(panel);
      expect(panel).toHaveAttribute("popover", "manual");
      expect(popover.show).toHaveBeenCalledTimes(1);
    } finally {
      popover.restore();
    }
  });
});
