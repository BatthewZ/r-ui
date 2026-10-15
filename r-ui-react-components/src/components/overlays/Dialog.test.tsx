import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./Dialog";
import { Drawer } from "./Drawer";
import { stubDialog } from "./overlay-stubs.test.helpers";

let dialogStub: ReturnType<typeof stubDialog>;
beforeEach(() => {
  dialogStub = stubDialog();
});
afterEach(() => {
  dialogStub.restore();
});

function Rename({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <Dialog onOpenChange={onOpenChange}>
      <Dialog.Trigger>Rename</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Rename dashboard</Dialog.Title>
          <Dialog.Description>Everyone with access sees the new name.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <label>
            Name <input defaultValue="Ops" />
          </label>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close>Cancel</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens modally from its trigger, named and described by its parts", async () => {
    const user = userEvent.setup();
    render(<Rename />);
    const trigger = screen.getByRole("button", { name: "Rename" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(trigger);
    expect(dialogStub.showModal).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole("dialog", { name: "Rename dashboard" });
    expect(dialog).toHaveAccessibleDescription("Everyone with access sees the new name.");
    expect(dialog.tagName).toBe("DIALOG");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("has a named corner close button, and Close parts close it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Rename onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dialogStub.close).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });

  it("Escape (the dialog's cancel) closes it through state", async () => {
    const user = userEvent.setup();
    render(<Rename />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog");
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);
    // The element is held open and state closes it, so `open` stays the one source of truth.
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dialogStub.close).toHaveBeenCalledTimes(1);
  });

  it("a close the element performs itself (form method=dialog) updates state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Rename onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    dialog.close();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    // Re-opening works: state did not stay stuck at `true`.
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("light-dismisses on a press that starts and ends on the scrim, not inside", async () => {
    const user = userEvent.setup();
    render(<Rename />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog");
    dialog.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 300, width: 200, height: 200, x: 100, y: 100, toJSON: () => ({}) });

    // Inside the panel's box: stays.
    fireEvent.pointerDown(dialog, { clientX: 150, clientY: 150 });
    fireEvent.click(dialog, { clientX: 150, clientY: 150 });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // On the scrim, both ends: closes.
    fireEvent.pointerDown(dialog, { clientX: 20, clientY: 20 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("children mount only while open", async () => {
    const user = userEvent.setup();
    render(<Rename />);
    expect(screen.queryByRole("textbox", { hidden: true })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it("alertdialog: no corner close, no light dismiss, Escape still cancels", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <Dialog.Trigger>Delete</Dialog.Trigger>
        <Dialog.Content role="alertdialog">
          <Dialog.Title>Delete 3 dashboards?</Dialog.Title>
          <Dialog.Description>This cannot be undone.</Dialog.Description>
          <Dialog.Footer>
            <Dialog.Close autoFocus>Cancel</Dialog.Close>
            <Dialog.Close variant="danger">Delete</Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const alert = screen.getByRole("alertdialog", { name: "Delete 3 dashboards?" });
    expect(alert).toHaveAccessibleDescription("This cannot be undone.");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    alert.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 300, width: 200, height: 200, x: 100, y: 100, toJSON: () => ({}) });
    fireEvent.pointerDown(alert, { clientX: 20, clientY: 20 });
    fireEvent.click(alert, { clientX: 20, clientY: 20 });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent(alert, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("without a Title it points aria-labelledby at nothing; aria-label names it instead", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content aria-label="Quick look">Body</Dialog.Content>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog", { name: "Quick look" });
    expect(dialog).not.toHaveAttribute("aria-labelledby");
    expect(dialog).not.toHaveAttribute("aria-describedby");
  });

  it("renders in place, so it inherits the density of where it is written", () => {
    render(
      <div data-density="compact" data-testid="compact">
        <Dialog defaultOpen>
          <Dialog.Content aria-label="Inside">Body</Dialog.Content>
        </Dialog>
      </div>
    );
    expect(screen.getByTestId("compact")).toContainElement(screen.getByRole("dialog"));
  });
});

describe("Drawer", () => {
  it("is the same modal with an edge: end by default, bottom on request", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Drawer>
        <Drawer.Trigger>Details</Drawer.Trigger>
        <Drawer.Content>
          <Drawer.Title>Incident 4821</Drawer.Title>
        </Drawer.Content>
      </Drawer>
    );
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(dialogStub.showModal).toHaveBeenCalledTimes(1);
    const drawer = screen.getByRole("dialog", { name: "Incident 4821" });
    expect(drawer).toHaveAttribute("data-side", "end");
    expect(drawer).toHaveClass("r-overlays-drawer-end");

    rerender(
      <Drawer>
        <Drawer.Trigger>Details</Drawer.Trigger>
        <Drawer.Content side="bottom">
          <Drawer.Title>Incident 4821</Drawer.Title>
        </Drawer.Content>
      </Drawer>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-side", "bottom");
    expect(screen.getByRole("dialog")).toHaveClass("r-overlays-drawer-bottom");
    expect(screen.getByRole("dialog")).not.toHaveClass("r-overlays-drawer-end");
  });

  it("Dialog and Drawer keep their own Content parts", () => {
    expect(Drawer.Content).not.toBe(Dialog.Content);
    expect(Drawer.Title).toBe(Dialog.Title);
  });
});
