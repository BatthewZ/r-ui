import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextMenu } from "./ContextMenu";
import { stubPopover } from "./overlay-stubs.test.helpers";

function Region({
  onOpen = vi.fn(),
  onBeforeOpen,
  disabled,
}: {
  onOpen?: () => void;
  onBeforeOpen?: (target: Element) => boolean | void;
  disabled?: boolean;
}) {
  return (
    <>
      <button type="button">Before</button>
      <ContextMenu>
        <ContextMenu.Trigger data-testid="region" onBeforeOpen={onBeforeOpen} disabled={disabled}>
          <p>Canvas</p>
          <button type="button">Row action</button>
        </ContextMenu.Trigger>
        <ContextMenu.Content aria-label="Canvas actions">
          <ContextMenu.Item onSelect={onOpen}>Open</ContextMenu.Item>
          <ContextMenu.Item disabled>Archive</ContextMenu.Item>
          <ContextMenu.Item>Duplicate</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item variant="danger">Delete</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
      <p>Elsewhere</p>
    </>
  );
}

describe("ContextMenu", () => {
  it("a right-click opens the menu, named by its label, with focus on the menu", async () => {
    const user = userEvent.setup();
    render(<Region />);
    expect(screen.queryByRole("menu")).toBeNull();
    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Canvas") });
    const menu = screen.getByRole("menu", { name: "Canvas actions" });
    expect(menu).toHaveFocus();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Open", "Archive", "Duplicate", "Delete"]);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
  });

  it("prevents the browser's own menu only when it opens", () => {
    const { unmount } = render(<Region />);
    // fireEvent returns false when the event was prevented.
    expect(fireEvent.contextMenu(screen.getByText("Canvas"), { button: 2 })).toBe(false);
    unmount();

    render(<Region disabled />);
    expect(fireEvent.contextMenu(screen.getByText("Canvas"), { button: 2 })).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("is positioned at the pointer, relative to the region", async () => {
    // floating-ui reads the viewport from these; jsdom leaves them at 0, and
    // flip()/shift() would then clamp every placement.
    for (const [prop, value] of [["clientWidth", 1024], ["clientHeight", 768]] as const) {
      Object.defineProperty(document.documentElement, prop, { value, configurable: true });
    }
    const user = userEvent.setup();
    render(<Region />);
    const region = screen.getByTestId("region");
    region.getBoundingClientRect = () =>
      ({ x: 100, y: 50, left: 100, top: 50, right: 500, bottom: 350, width: 400, height: 300 }) as DOMRect;
    await user.pointer({ keys: "[MouseRight]", target: region, coords: { clientX: 220, clientY: 130 } });
    const menu = screen.getByRole("menu");
    // bottom-start of a zero-size point. The gap is a token jsdom cannot resolve, so 0.
    await waitFor(() => expect(menu.style.transform).toBe("translate(220px, 130px)"));

    // The region scrolls by 40px: the anchor moves with it.
    region.getBoundingClientRect = () =>
      ({ x: 100, y: 10, left: 100, top: 10, right: 500, bottom: 310, width: 400, height: 300 }) as DOMRect;
    fireEvent.scroll(window);
    await waitFor(() => expect(menu.style.transform).toBe("translate(220px, 90px)"));
    for (const prop of ["clientWidth", "clientHeight"]) {
      delete (document.documentElement as unknown as Record<string, unknown>)[prop];
    }
  });

  it("Shift+F10 opens at the focused element on its first item; Escape returns focus there", async () => {
    const user = userEvent.setup();
    render(<Region />);
    const action = screen.getByRole("button", { name: "Row action" });
    action.focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(action).toHaveFocus();
  });

  it("the Menu key opens it too, and a keyboard-made contextmenu event opens at the element", async () => {
    const user = userEvent.setup();
    render(<Region />);
    const action = screen.getByRole("button", { name: "Row action" });
    action.focus();
    await user.keyboard("{ContextMenu}");
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
    await user.keyboard("{Escape}");

    // An engine that fires contextmenu from the key itself (Chromium: button -1).
    fireEvent.contextMenu(action, { button: -1 });
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
  });

  it("keyboard model is the shared menu's: arrows land on disabled and wrap, Home/End, typeahead, Enter runs and closes", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Region onOpen={onOpen} />);
    const action = screen.getByRole("button", { name: "Row action" });
    action.focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
    await user.keyboard("d");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
    await user.keyboard("{Home}{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(action).toHaveFocus();
  });

  it("onBeforeOpen receives the target and can leave the browser's menu", async () => {
    const onBeforeOpen = vi.fn((target: Element) => target.tagName !== "P");
    render(<Region onBeforeOpen={onBeforeOpen} />);
    expect(fireEvent.contextMenu(screen.getByText("Canvas"), { button: 2 })).toBe(true);
    expect(onBeforeOpen).toHaveBeenLastCalledWith(screen.getByText("Canvas"));
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(screen.getByRole("button", { name: "Row action" }), { button: 2 });
    expect(onBeforeOpen).toHaveBeenLastCalledWith(screen.getByRole("button", { name: "Row action" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("a press outside closes it", async () => {
    const user = userEvent.setup();
    render(<Region />);
    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Canvas") });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByText("Elsewhere"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("only the innermost of nested regions opens, by pointer and by keyboard, and the browser's own menu stays shut", async () => {
    const user = userEvent.setup();
    render(
      <ContextMenu>
        <ContextMenu.Trigger>
          <ContextMenu>
            <ContextMenu.Trigger>
              <button type="button">Inner</button>
            </ContextMenu.Trigger>
            <ContextMenu.Content aria-label="Inner menu">
              <ContextMenu.Item>Inner item</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu>
        </ContextMenu.Trigger>
        <ContextMenu.Content aria-label="Outer menu">
          <ContextMenu.Item>Outer item</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    );
    const inner = screen.getByRole("button", { name: "Inner" });
    // fireEvent returns false when the event's default was prevented.
    expect(fireEvent.contextMenu(inner, { button: 2 })).toBe(false);
    expect(screen.getByRole("menu", { name: "Inner menu" })).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Outer menu" })).toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    inner.focus();
    expect(fireEvent.keyDown(inner, { key: "F10", shiftKey: true })).toBe(false);
    expect(screen.getByRole("menu", { name: "Inner menu" })).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Outer menu" })).toBeNull();
  });

  it("asChild puts the region behaviour on the caller's element", () => {
    render(
      <ContextMenu>
        <ContextMenu.Trigger asChild>
          <section aria-label="Board">Board</section>
        </ContextMenu.Trigger>
        <ContextMenu.Content aria-label="Board actions">
          <ContextMenu.Item>Add card</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    );
    const board = screen.getByRole("region", { name: "Board" });
    expect(board).toHaveClass("r-overlays-context-region");
    fireEvent.contextMenu(board, { button: 2 });
    expect(screen.getByRole("menu", { name: "Board actions" })).toBeInTheDocument();
  });
});

describe("ContextMenu long press", () => {
  afterEach(() => vi.useRealTimers());

  const touch = { pointerType: "touch", pointerId: 7, isPrimary: true };

  it("a touch held still opens it under the finger, and the release's mouse events are swallowed", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <ContextMenu>
        <ContextMenu.Trigger>
          <button type="button" onClick={onClick}>
            Row
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Content aria-label="Row actions">
          <ContextMenu.Item>Edit</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    );
    const row = screen.getByRole("button", { name: "Row" });
    fireEvent.pointerDown(row, { ...touch, clientX: 40, clientY: 40 });
    act(() => vi.advanceTimersByTime(499));
    expect(screen.queryByRole("menu")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("menu", { name: "Row actions" })).toBeInTheDocument();
    fireEvent.pointerUp(row, touch);
    // The release's mousedown moves no focus out of the menu; its click reaches nothing.
    expect(fireEvent.mouseDown(row)).toBe(false);
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(0);
    // The next tap is an ordinary one.
    fireEvent.pointerDown(row, touch);
    fireEvent.pointerUp(row, touch);
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a touch that moves past the slop (a scroll) or lifts early never opens it", () => {
    vi.useFakeTimers();
    render(<Region />);
    const canvas = screen.getByText("Canvas");
    fireEvent.pointerDown(canvas, { ...touch, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { ...touch, clientX: 40, clientY: 52 });
    act(() => vi.advanceTimersByTime(800));
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.pointerDown(canvas, { ...touch, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, touch);
    act(() => vi.advanceTimersByTime(800));
    expect(screen.queryByRole("menu")).toBeNull();

    // Within the slop it still opens.
    fireEvent.pointerDown(canvas, { ...touch, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { ...touch, clientX: 44, clientY: 46 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("a contextmenu the platform sends before the long press fires opens it once, and focus still returns home", () => {
    vi.useFakeTimers();
    const onBeforeOpen = vi.fn();
    render(<Region onBeforeOpen={onBeforeOpen} />);
    const action = screen.getByRole("button", { name: "Row action" });
    action.focus();
    fireEvent.pointerDown(action, { ...touch, clientX: 40, clientY: 40 });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.contextMenu(action, { button: 2, clientX: 40, clientY: 40 });
    expect(screen.getByRole("menu")).toHaveFocus();
    act(() => vi.advanceTimersByTime(400));
    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(action).toHaveFocus();
  });

  it("a mouse press never starts a long press", () => {
    vi.useFakeTimers();
    render(<Region />);
    fireEvent.pointerDown(screen.getByText("Canvas"), { pointerType: "mouse", clientX: 40, clientY: 40 });
    act(() => vi.advanceTimersByTime(800));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("ContextMenu floating model", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("is promoted to the top layer in place, inside an overflow:hidden ancestor, not portalled", () => {
    const popover = stubPopover();
    restore = popover.restore;
    render(
      <div data-testid="clip" style={{ overflow: "hidden" }}>
        <Region />
      </div>
    );
    fireEvent.contextMenu(screen.getByText("Canvas"), { button: 2 });
    const menu = screen.getByRole("menu", { hidden: true });
    expect(menu).toHaveAttribute("popover", "manual");
    expect(popover.show.mock.contexts[0]).toBe(menu);
    expect(screen.getByTestId("clip")).toContainElement(menu);
    expect(menu.style.position).toBe("fixed");
  });
});
