import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { HoverCard, type HoverCardProps } from "./HoverCard";
import { stubPopover } from "./overlay-stubs.test.helpers";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * jsdom parses `:focus-visible` but never matches it. Emulate the browser for a
 * test driven by the keyboard alone: the focused element is focus-visible.
 */
function stubFocusVisible() {
  const real = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    if (selector === ":focus-visible") return this === this.ownerDocument.activeElement;
    return real.call(this, selector);
  });
}

function Profile({ onNavigate, toggle = false, ...props }: Partial<HoverCardProps> & { onNavigate?: () => void; toggle?: boolean }) {
  return (
    <>
      <button type="button">Before</button>
      <HoverCard openDelay={500} closeDelay={300} {...props}>
        <HoverCard.Trigger>
          <a
            href="#/users/ada"
            onClick={(event) => {
              event.preventDefault();
              onNavigate?.();
            }}
          >
            @ada
          </a>
        </HoverCard.Trigger>
        {toggle && <HoverCard.Toggle label="Preview @ada" />}
        <HoverCard.Content>
          <p>Ada Lovelace · 128 repositories</p>
          <button type="button">Follow</button>
          <a href="#/users/ada/repos">Repositories</a>
        </HoverCard.Content>
      </HoverCard>
      <button type="button">After</button>
    </>
  );
}

const card = () => screen.queryByRole("group", { name: "@ada" });
const hover = (el: Element) => {
  fireEvent.pointerEnter(el, { pointerType: "mouse" });
  fireEvent.mouseEnter(el);
  fireEvent.mouseMove(el);
};

describe("HoverCard", () => {
  it("opens on mouse hover only after the delay, as a group named by its trigger, in place after it", () => {
    vi.useFakeTimers();
    render(<Profile />);
    const trigger = screen.getByRole("link", { name: "@ada" });
    hover(trigger);
    act(() => vi.advanceTimersByTime(499));
    expect(card()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const group = card();
    expect(group).toHaveTextContent("Ada Lovelace");
    // In place: the card follows its trigger in the DOM, so Tab reaches it next.
    expect(trigger.nextElementSibling).toBe(group);
  });

  it("is promoted to the top layer where the platform can", () => {
    vi.useFakeTimers();
    const popover = stubPopover();
    try {
      render(<Profile defaultOpen />);
      const group = document.querySelector('[role="group"]')!;
      expect(group).toHaveAttribute("popover", "manual");
      expect(popover.show).toHaveBeenCalledTimes(1);
      expect(group).toHaveClass("r-overlays-surface");
    } finally {
      popover.restore();
    }
  });

  it("keyboard focus opens it after the delay; Tab walks into it and out the other side, and it closes behind", async () => {
    stubFocusVisible();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Profile />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole("link", { name: "@ada" })).toHaveFocus();
    expect(card()).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(card()).not.toBeNull();
    // Opening never moves focus.
    expect(screen.getByRole("link", { name: "@ada" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Follow" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("link", { name: "@ada" })).toHaveFocus();
    expect(card()).not.toBeNull();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expect(card()).toBeNull();
  });

  it("focus passing over the trigger before the delay never opens it", async () => {
    stubFocusVisible();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Profile />);
    await user.tab();
    await user.tab();
    act(() => vi.advanceTimersByTime(200));
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    act(() => vi.advanceTimersByTime(1000));
    expect(card()).toBeNull();
  });

  it("Escape inside the card closes it and hands focus back to the trigger, and is consumed", async () => {
    stubFocusVisible();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const outer = vi.fn();
    render(
      <div onKeyDown={(e) => outer(e.key, e.defaultPrevented)}>
        <Profile defaultOpen />
      </div>,
    );
    screen.getByRole("button", { name: "Follow" }).focus();
    await user.keyboard("{Escape}");
    expect(card()).toBeNull();
    expect(screen.getByRole("link", { name: "@ada" })).toHaveFocus();
    expect(outer).toHaveBeenLastCalledWith("Escape", true);
    // The focus it handed back does not open it again.
    act(() => vi.advanceTimersByTime(1000));
    expect(card()).toBeNull();
    // Closed, the trigger leaves Escape to whatever encloses it.
    await user.keyboard("{Escape}");
    expect(outer).toHaveBeenLastCalledWith("Escape", false);
  });

  it("Escape closes a hover-opened card while focus is elsewhere (WCAG 1.4.13)", () => {
    vi.useFakeTimers();
    render(
      <>
        <input aria-label="Search" />
        <Profile />
      </>,
    );
    const search = screen.getByRole("textbox", { name: "Search" });
    act(() => search.focus());
    hover(screen.getByRole("link", { name: "@ada" }));
    act(() => vi.advanceTimersByTime(500));
    expect(card()).not.toBeNull();
    const escape = fireEvent.keyDown(search, { key: "Escape" });
    expect(escape).toBe(false);
    expect(card()).toBeNull();
    expect(search).toHaveFocus();
  });

  it("stays open while the pointer is on the card, closes after it leaves, but not from under keyboard focus", () => {
    vi.useFakeTimers();
    render(<Profile />);
    const trigger = screen.getByRole("link", { name: "@ada" });
    hover(trigger);
    act(() => vi.advanceTimersByTime(500));
    const group = card()!;
    fireEvent.mouseEnter(group);
    act(() => vi.advanceTimersByTime(1000));
    expect(card()).not.toBeNull();

    // Focus inside: the pointer leaving does not close it.
    act(() => screen.getByRole("button", { name: "Follow" }).focus());
    fireEvent.mouseLeave(group);
    act(() => vi.advanceTimersByTime(1000));
    expect(card()).not.toBeNull();

    // Focus leaving the card (pointer not on it) closes it.
    act(() => screen.getByRole("button", { name: "Before" }).focus());
    expect(card()).toBeNull();

    // Focus elsewhere: the pointer leaving closes it, after the close delay.
    hover(trigger);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.mouseEnter(card()!);
    fireEvent.mouseLeave(card()!);
    act(() => vi.advanceTimersByTime(299));
    expect(card()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(card()).toBeNull();
  });

  it("a touch hover never opens it, and a click on the trigger still navigates", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    render(<Profile onNavigate={onNavigate} openDelay={0} />);
    const trigger = screen.getByRole("link", { name: "@ada" });
    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    act(() => vi.advanceTimersByTime(1000));
    expect(card()).toBeNull();
    fireEvent.click(trigger);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not stop the trigger's own click while open", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Profile onNavigate={onNavigate} defaultOpen />);
    await user.click(screen.getByRole("link", { name: "@ada" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("the toggle opens it with a press, keeps it past the pointer leaving, and closes it again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Profile toggle />);
    const toggle = screen.getByRole("button", { name: "Preview @ada" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const group = card()!;
    expect(group).not.toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", group.id);
    fireEvent.mouseLeave(screen.getByRole("link", { name: "@ada" }));
    fireEvent.mouseLeave(group);
    act(() => vi.advanceTimersByTime(1000));
    expect(card()).not.toBeNull();
    // Tab from the toggle walks into the card.
    await user.tab();
    expect(screen.getByRole("button", { name: "Follow" })).toHaveFocus();
    await user.click(toggle);
    expect(card()).toBeNull();
  });

  it("a press outside closes a toggled card", async () => {
    const user = userEvent.setup();
    render(<Profile toggle />);
    await user.click(screen.getByRole("button", { name: "Preview @ada" }));
    expect(card()).not.toBeNull();
    await user.click(document.body);
    expect(card()).toBeNull();
  });

  it("is controllable", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Profile open onOpenChange={onOpenChange} />);
    expect(card()).not.toBeNull();
    fireEvent.keyDown(screen.getByRole("link", { name: "@ada" }), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    // Still open until the parent says otherwise.
    expect(card()).not.toBeNull();
    rerender(<Profile open={false} onOpenChange={onOpenChange} />);
    expect(card()).toBeNull();
  });

  it("disabled: hover and focus open nothing and the trigger stays", () => {
    vi.useFakeTimers();
    render(<Profile disabled />);
    const trigger = screen.getByRole("link", { name: "@ada" });
    hover(trigger);
    act(() => trigger.focus());
    act(() => vi.advanceTimersByTime(2000));
    expect(card()).toBeNull();
  });

  it("names its toggle from the labels when the caller gives none", () => {
    render(
      <LocaleProvider labels={{ HoverCard: { toggle: "Vorschau" } }}>
        <HoverCard>
          <HoverCard.Trigger>
            <a href="#/x">x</a>
          </HoverCard.Trigger>
          <HoverCard.Toggle />
          <HoverCard.Content>body</HoverCard.Content>
        </HoverCard>
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Vorschau" })).toBeInTheDocument();
  });

  it("keeps the trigger's own id, and names the card by it", () => {
    render(
      <HoverCard defaultOpen>
        <HoverCard.Trigger>
          <a id="ada-link" href="#/users/ada">
            @ada
          </a>
        </HoverCard.Trigger>
        <HoverCard.Content>body</HoverCard.Content>
      </HoverCard>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("id", "ada-link");
    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "ada-link");
  });
});
