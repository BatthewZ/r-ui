import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubPopover } from "./overlay-stubs.test.helpers";
import { Tooltip } from "./Tooltip";

afterEach(() => {
  vi.useRealTimers();
});

describe("Tooltip", () => {
  it("opens on keyboard focus and describes its trigger", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Copies the link">
        <button type="button">Copy</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Copy" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(trigger).not.toHaveAttribute("aria-describedby");

    await user.tab();
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Copies the link");
    expect(trigger).toHaveAccessibleDescription("Copies the link");
    // The name stays the trigger's own: the tooltip only describes.
    expect(trigger).toHaveAccessibleName("Copy");
  });

  it("appends to an existing aria-describedby instead of replacing it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p id="hint">Shortcut: C</p>
        <Tooltip content="Copies the link">
          <button type="button" aria-describedby="hint">
            Copy
          </button>
        </Tooltip>
      </>
    );
    await user.tab();
    const trigger = screen.getByRole("button", { name: "Copy" });
    expect(trigger.getAttribute("aria-describedby")?.split(" ")).toEqual(["hint", screen.getByRole("tooltip").id]);
    expect(trigger).toHaveAccessibleDescription("Shortcut: C Copies the link");
  });

  it("opens on mouse hover only after the delay", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Later" delay={400}>
        <button type="button">Hover me</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    fireEvent.mouseMove(trigger);
    act(() => vi.advanceTimersByTime(399));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Later");
  });

  it("a touch hover never opens it, so a tap goes straight to the trigger", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <Tooltip content="Not on touch" delay={0}>
        <button type="button" onClick={onClick}>
          Tap
        </button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Tap" });
    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    fireEvent.mouseMove(trigger);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Escape closes it and is consumed, so an enclosing surface stays open", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    render(
      <div onKeyDown={(e) => outer(e.defaultPrevented)}>
        <Tooltip content="Help">
          <button type="button">Help</button>
        </Tooltip>
      </div>
    );
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenLastCalledWith(true);

    // Closed, the trigger leaves Escape alone for whatever encloses it.
    await user.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledTimes(2);
    expect(outer).toHaveBeenLastCalledWith(false);
  });

  it("Escape dismisses a hover-opened tooltip while focus is elsewhere (WCAG 1.4.13)", () => {
    vi.useFakeTimers();
    render(
      <>
        <input aria-label="Search" />
        <Tooltip content="Later" delay={0}>
          <button type="button">Hover me</button>
        </Tooltip>
      </>
    );
    const search = screen.getByRole("textbox", { name: "Search" });
    act(() => search.focus());
    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    fireEvent.mouseMove(trigger);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(search).toHaveFocus();

    const escape = fireEvent.keyDown(search, { key: "Escape" });
    expect(escape).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stands down when the focused surface used Escape itself", () => {
    vi.useFakeTimers();
    const onKeyDown = vi.fn((event: ReactKeyboardEvent) => {
      if (event.key === "Escape") event.preventDefault();
    });
    render(
      <>
        <input aria-label="Search" onKeyDown={onKeyDown} />
        <Tooltip content="Later" delay={0}>
          <button type="button">Hover me</button>
        </Tooltip>
      </>
    );
    const search = screen.getByRole("textbox", { name: "Search" });
    act(() => search.focus());
    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    fireEvent.mouseMove(trigger);
    act(() => vi.advanceTimersByTime(1));
    fireEvent.keyDown(search, { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("keeps the trigger's own handlers", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onClick = vi.fn();
    render(
      <Tooltip content="Tip">
        <button type="button" onFocus={onFocus} onClick={onClick}>
          Go
        </button>
      </Tooltip>
    );
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled renders the trigger with no tooltip", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip" disabled>
        <button type="button">Go</button>
      </Tooltip>
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Go" })).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders in place next to its trigger and asks for the top layer", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      render(
        <div data-testid="clip" style={{ overflow: "hidden" }}>
          <Tooltip content="Tip">
            <button type="button">Go</button>
          </Tooltip>
        </div>
      );
      await user.tab();
      const tip = screen.getByRole("tooltip", { hidden: true });
      expect(screen.getByTestId("clip")).toContainElement(tip);
      expect(tip).toHaveAttribute("popover", "manual");
      expect(popover.show).toHaveBeenCalledTimes(1);
    } finally {
      popover.restore();
    }
  });
});
