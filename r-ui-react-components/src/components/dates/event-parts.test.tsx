import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type CalendarEvent, placeEvents } from "./event-core";
import { EventTarget, isInteractiveEvent } from "./event-parts";

const one = (event: Partial<CalendarEvent>) =>
  placeEvents([{ id: "e", title: "Deploy", start: new Date(2026, 9, 15, 14), ...event }])[0]!;

describe("EventTarget", () => {
  it("is a link for a safe href, a button with onEventClick, and text otherwise", async () => {
    const onEventClick = vi.fn();
    const { rerender } = render(<EventTarget placed={one({ href: "/deploys/42" })} name="Deploy, 2:00 PM">x</EventTarget>);
    expect(screen.getByRole("link", { name: "Deploy, 2:00 PM" })).toHaveAttribute("href", "/deploys/42");

    rerender(
      <EventTarget placed={one({})} name="Deploy, 2:00 PM" onEventClick={onEventClick}>
        x
      </EventTarget>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Deploy, 2:00 PM" }));
    expect(onEventClick).toHaveBeenCalledTimes(1);

    rerender(<EventTarget placed={one({})} name="Deploy, 2:00 PM">x</EventTarget>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Deploy, 2:00 PM")).toHaveClass("sr-only");
  });

  it("never makes a text event focusable, even when given a tabIndex", () => {
    const { container } = render(
      <EventTarget placed={one({})} name="Deploy" tabIndex={0}>
        x
      </EventTarget>,
    );
    const target = container.querySelector("[data-event]");
    expect(target).not.toBeNull();
    expect(target).not.toHaveAttribute("tabindex");
  });

  it("draws an unsafe href as text, and isInteractiveEvent agrees", () => {
    const unsafe = one({ href: "javascript:alert(1)" });
    render(<EventTarget placed={unsafe} name="Deploy">x</EventTarget>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(isInteractiveEvent(unsafe, undefined)).toBe(false);
    expect(isInteractiveEvent(one({ href: "/ok" }), undefined)).toBe(true);
    expect(isInteractiveEvent(unsafe, () => {})).toBe(true);
  });
});
