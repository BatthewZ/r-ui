import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu } from "./DropdownMenu";
import { stubPopover } from "./overlay-stubs.test.helpers";

function Menu({ onRename = vi.fn(), onDelete = vi.fn() }: { onRename?: () => void; onDelete?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onSelect={onRename}>Rename</DropdownMenu.Item>
        <DropdownMenu.Item disabled>Archive</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item tone="error" onSelect={onDelete}>
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

describe("DropdownMenu", () => {
  it("wires the trigger to the menu and names the menu by it", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(trigger);
    const menu = screen.getByRole("menu", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Rename",
      "Archive",
      "Duplicate",
      "Delete",
    ]);
  });

  it("opens from the keyboard on the first item; ArrowUp opens on the last", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("a pointer open focuses the menu itself, so arrows start from the top", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
  });

  it("arrows skip disabled items and wrap; Home and End jump", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("typeahead moves to the next item starting with the typed letters", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("d");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
    // A repeated first letter cycles to the next match.
    await user.keyboard("d");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("Enter and Space select, close, and return focus to the trigger", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(<Menu onRename={onRename} onDelete={onDelete} />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    await user.keyboard(" ");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("a disabled item is announced as disabled and does nothing when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item disabled onSelect={onSelect}>
            Archive
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    const item = screen.getByRole("menuitem", { name: "Archive" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.click(item);
    expect(onSelect).toHaveBeenCalledTimes(0);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  // Where Tab then lands (the element after the trigger) is the browser's own
  // move from the refocused trigger; user-event computes Tab from the original
  // target instead, so that half is checked in a real browser.
  it("Escape closes and returns focus; Tab closes", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("a press outside closes it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu />
        <p>Elsewhere</p>
      </>
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByText("Elsewhere"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("checkbox items toggle aria-checked and keep the menu open", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>View</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.CheckboxItem defaultChecked onCheckedChange={onCheckedChange}>
            Show grid
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    const item = screen.getByRole("menuitemcheckbox", { name: "Show grid" });
    expect(item).toHaveAttribute("aria-checked", "true");
    await user.click(item);
    expect(item).toHaveAttribute("aria-checked", "false");
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("radio items are exclusive within their group", async () => {
    const user = userEvent.setup();
    function Sort() {
      const [value, setValue] = useState("name");
      return (
        <DropdownMenu defaultOpen>
          <DropdownMenu.Trigger>Sort</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Label id="sort-label">Sort by</DropdownMenu.Label>
            <DropdownMenu.RadioGroup aria-labelledby="sort-label" value={value} onValueChange={setValue}>
              <DropdownMenu.RadioItem value="name">Name</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="date">Date</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu>
      );
    }
    render(<Sort />);
    expect(screen.getByRole("group", { name: "Sort by" })).toBeInTheDocument();
    const name = screen.getByRole("menuitemradio", { name: "Name" });
    const date = screen.getByRole("menuitemradio", { name: "Date" });
    expect(name).toHaveAttribute("aria-checked", "true");
    expect(date).toHaveAttribute("aria-checked", "false");
    await user.click(date);
    expect(name).toHaveAttribute("aria-checked", "false");
    expect(date).toHaveAttribute("aria-checked", "true");
  });

  it("asChild puts the trigger behaviour on the caller's element and keeps its handlers", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label="More" onClick={onClick} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>One</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await user.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("marks a destructive item with the error tone", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Keep</DropdownMenu.Item>
          <DropdownMenu.Item tone="error">Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-fg-error");
    expect(screen.getByRole("menuitem", { name: "Keep" })).not.toHaveClass("text-fg-error");
  });
});

/**
 * The floating model. jsdom has no top layer and resolves no `var()` in a used
 * value, so these assert the two facts the model rests on: the panel is a DOM
 * descendant of where it is written (so custom properties such as `--ROW-H`
 * inherit from there), and it asks to be promoted. The paint itself (compact
 * and unclipped) is measured in a browser against the showcase.
 */
describe("DropdownMenu floating model", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
    document.getElementById("density-fixture")?.remove();
  });

  /** The contract's shape: :root comfortable, [data-density] re-selects. Values are fixture values. */
  function installDensityFixture() {
    const style = document.createElement("style");
    style.id = "density-fixture";
    style.textContent = `:root { --ROW-H: 40px; } [data-density="compact"] { --ROW-H: 30px; }`;
    document.head.append(style);
  }

  it("a menu opened inside a compact container resolves the compact --ROW-H on its items", async () => {
    installDensityFixture();
    const user = userEvent.setup();
    render(
      <>
        <div data-density="compact" data-testid="compact-card">
          <DropdownMenu>
            <DropdownMenu.Trigger>Compact</DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>Inside</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenu.Trigger>Page</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Outside</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </>
    );
    await user.click(screen.getByRole("button", { name: "Compact" }));
    const inside = screen.getByRole("menuitem", { name: "Inside" });
    expect(screen.getByTestId("compact-card")).toContainElement(inside);
    expect(inside).toHaveClass("min-h-row");
    expect(getComputedStyle(inside).getPropertyValue("--ROW-H")).toBe("30px");

    // Positive control: the same menu written outside the card reads the page value.
    await user.click(screen.getByRole("button", { name: "Page" }));
    const outside = screen.getByRole("menuitem", { name: "Outside" });
    expect(getComputedStyle(outside).getPropertyValue("--ROW-H")).toBe("40px");
  });

  it("is promoted to the top layer in place, inside an overflow:hidden ancestor, not portalled", async () => {
    const popover = stubPopover();
    restore = popover.restore;
    const user = userEvent.setup();
    render(
      <div data-testid="clip" style={{ overflow: "hidden" }}>
        <DropdownMenu>
          <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>One</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu", { hidden: true });
    expect(menu).toHaveAttribute("popover", "manual");
    expect(popover.show).toHaveBeenCalledTimes(1);
    expect(popover.show.mock.contexts[0]).toBe(menu);
    expect(screen.getByTestId("clip")).toContainElement(menu);
    // A top-layer box is positioned against the viewport.
    expect(menu.style.position).toBe("fixed");
  });
});
