import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./Dialog";
import { DropdownMenu } from "./DropdownMenu";
import { stubDialog, stubPopover } from "./overlay-stubs.test.helpers";
import { Popover } from "./Popover";

/**
 * jsdom runs no CSS and has no Web Animations API, which is the shipped
 * fallback (an instant close) and what every other overlay test exercises. Here
 * `getAnimations` is stubbed per test to report one running exit on the element
 * asked, finished only when the test says so: the browser half (that CSS really
 * starts one) is `scripts/browser/motion-overlay-exit.js`.
 */
function stubExits() {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  const pending: Array<{ element: Element; finish: () => void }> = [];
  const getAnimations = vi.fn(function (this: Element) {
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    pending.push({ element: this, finish });
    return [{ finished, effect: { getTiming: () => ({ iterations: 1 }) } }];
  });
  proto.getAnimations = getAnimations;
  return {
    getAnimations,
    pending,
    async finishAll() {
      await act(async () => {
        for (const p of pending.splice(0)) p.finish();
      });
    },
    restore() {
      delete proto.getAnimations;
    },
  };
}

let exits: ReturnType<typeof stubExits>;
beforeEach(() => {
  exits = stubExits();
});
afterEach(() => {
  exits.restore();
});

describe("overlay exits", () => {
  it("a closed Popover stays mounted, inert, until its exit finishes; focus is back at once", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger>Filters</Popover.Trigger>
          <Popover.Content aria-label="Filters">
            <Popover.Close>Done</Popover.Close>
          </Popover.Content>
        </Popover>
      );
      const trigger = screen.getByRole("button", { name: "Filters" });
      await user.click(trigger);
      const panel = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(panel).not.toBeNull();
      expect(panel).not.toHaveAttribute("inert");

      await user.click(screen.getByRole("button", { name: "Done", hidden: true }));
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      // Still rendered: the same node, now inert, with an exit pending on it.
      expect(document.querySelector('[role="dialog"]')).toBe(panel);
      expect(panel).toHaveAttribute("inert");
      expect(exits.pending.map((p) => p.element)).toContain(panel);
      await waitFor(() => expect(trigger).toHaveFocus());

      await exits.finishAll();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      popover.restore();
    }
  });

  it("re-opened mid-exit, the Popover keeps its node and is interactive again", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger>Filters</Popover.Trigger>
          <Popover.Content aria-label="Filters">
            <p>Body</p>
          </Popover.Content>
        </Popover>
      );
      const trigger = screen.getByRole("button", { name: "Filters" });
      await user.click(trigger);
      const panel = document.querySelector('[role="dialog"]');
      await user.click(trigger);
      expect(panel).toHaveAttribute("inert");
      // A press on the trigger during the exit reopens; it does not close again.
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(document.querySelector('[role="dialog"]')).toBe(panel);
      expect(panel).not.toHaveAttribute("inert");

      // The abandoned exit finishing later must not unmount the open panel.
      await exits.finishAll();
      expect(document.querySelector('[role="dialog"]')).toBe(panel);
    } finally {
      popover.restore();
    }
  });

  it("a closed menu leaves the same way and hands focus to its trigger", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Rename</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    const menu = screen.getByRole("menu");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(document.querySelector('[role="menu"]')).toBe(menu);
    expect(menu).toHaveAttribute("inert");
    await exits.finishAll();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("a closed Dialog keeps its content through the exit, then drops it", async () => {
    const dialogStub = stubDialog();
    try {
      const user = userEvent.setup();
      render(
        <Dialog>
          <Dialog.Trigger>Rename</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Rename dashboard</Dialog.Title>
            <Dialog.Close>Cancel</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      );
      await user.click(screen.getByRole("button", { name: "Rename" }));
      const dialog = screen.getByRole("dialog", { name: "Rename dashboard" });
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(dialogStub.close).toHaveBeenCalledTimes(1);
      expect(dialog).toHaveAttribute("inert");
      expect(dialog).toHaveTextContent("Rename dashboard");
      expect(exits.pending.map((p) => p.element)).toContain(dialog);

      await exits.finishAll();
      expect(dialog).not.toHaveTextContent("Rename dashboard");
      expect(dialog).not.toHaveAttribute("inert");
    } finally {
      dialogStub.restore();
    }
  });
});
