// West of Greenwich before any local Date is built.
process.env.TZ = "America/New_York";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { EventCalendar, type EventCalendarEventDetails, type EventCalendarProps } from "./EventCalendar";
import type { CalendarEvent } from "./event-core";
import type { CalendarEventChange } from "./event-edit";

/** An app's own event: everything `CalendarEvent` has, and what the app keeps beside it. */
interface Booking extends CalendarEvent {
  room: string;
  attachments: { name: string; href: string }[];
}

const NOW = new Date(2026, 9, 15, 10, 40);
const at = (date: number, hour: number, minute = 0) => new Date(2026, 9, date, hour, minute);
const REVIEW: Booking = {
  id: "review",
  title: "Design review",
  start: at(14, 10),
  end: at(14, 11, 30),
  room: "4.12",
  attachments: [{ name: "Agenda.pdf", href: "/files/agenda.pdf" }],
};
const INTERVIEW: Booking = { id: "interview", title: "Interview", start: at(15, 13), end: at(15, 14), room: "2.01", attachments: [] };

function renderDetails(props: Partial<EventCalendarProps<Booking>> = {}) {
  const seen: EventCalendarEventDetails<Booking>[] = [];
  const utils = render(
    <EventCalendar<Booking>
      aria-label="Bookings"
      events={[REVIEW, INTERVIEW]}
      now={NOW}
      locale="en-US"
      defaultView="week"
      defaultDate={at(15, 0)}
      renderEventDetails={(details) => {
        seen.push(details);
        return (
          <section aria-label={`${details.event.title} details`}>
            <p>Room {details.event.room}</p>
            {details.event.attachments.map((a) => (
              <a key={a.href} href={a.href}>
                {a.name}
              </a>
            ))}
            <button type="button" onClick={details.close}>
              Close
            </button>
          </section>
        );
      }}
      {...props}
    />,
  );
  return { ...utils, seen };
}

const details = (title: string) => screen.queryByRole("region", { name: `${title} details` });
const block = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title},`) });

describe("EventCalendar with your own event type", () => {
  it("hands your type back from every callback, with no cast", () => {
    expectTypeOf<Parameters<NonNullable<EventCalendarProps<Booking>["onEventClick"]>>[0]>().toEqualTypeOf<Booking>();
    expectTypeOf<Parameters<NonNullable<EventCalendarProps<Booking>["onEventChange"]>>[0]>().toEqualTypeOf<CalendarEventChange<Booking>>();
    expectTypeOf<CalendarEventChange<Booking>["event"]>().toEqualTypeOf<Booking>();
    expectTypeOf<EventCalendarEventDetails<Booking>["event"]>().toEqualTypeOf<Booking>();
    // Without one, it is CalendarEvent, as before.
    expectTypeOf<Parameters<NonNullable<EventCalendarProps["onEventClick"]>>[0]>().toEqualTypeOf<CalendarEvent>();
  });

  it("gives onEventClick the very object it was given", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn<(event: Booking) => void>();
    renderDetails({ onEventClick, renderEventDetails: undefined });
    await user.click(block("Design review"));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick.mock.calls[0]?.[0]).toBe(REVIEW);
  });
});

describe("EventCalendar renderEventDetails", () => {
  it("opens your surface with your object, anchored at the element pressed, until close", async () => {
    const user = userEvent.setup();
    const { seen } = renderDetails();
    expect(details("Design review")).toBeNull();
    const pressed = block("Design review");
    await user.click(pressed);
    expect(details("Design review")).toHaveTextContent("Room 4.12");
    expect(screen.getByRole("link", { name: "Agenda.pdf" })).toHaveAttribute("href", "/files/agenda.pdf");
    expect(seen.at(-1)?.event).toBe(REVIEW);
    const box = new DOMRect(300, 200, 120, 60);
    pressed.getBoundingClientRect = () => box;
    expect(seen.at(-1)?.anchor.getBoundingClientRect()).toBe(box);
    expect(seen.at(-1)?.anchor.contextElement).toBe(pressed);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(details("Design review")).toBeNull();
  });

  it("makes text events buttons, opens by Enter, and switches to another event", async () => {
    const user = userEvent.setup();
    // No onEventClick: renderEventDetails alone makes events openable.
    renderDetails();
    act(() => block("Interview").focus());
    await user.keyboard("{Enter}");
    expect(details("Interview")).not.toBeNull();
    await user.click(block("Design review"));
    expect(details("Interview")).toBeNull();
    expect(details("Design review")).not.toBeNull();
  });

  it("closes when the event leaves events, and when the period changes", async () => {
    const user = userEvent.setup();
    const { rerender } = renderDetails();
    await user.click(block("Interview"));
    expect(details("Interview")).not.toBeNull();
    rerender(
      <EventCalendar<Booking>
        aria-label="Bookings"
        events={[REVIEW]}
        now={NOW}
        locale="en-US"
        defaultView="week"
        defaultDate={at(15, 0)}
        renderEventDetails={(d) => <section aria-label={`${d.event.title} details`} />}
      />,
    );
    expect(details("Interview")).toBeNull();

    await user.click(block("Design review"));
    expect(details("Design review")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(details("Design review")).toBeNull();
  });

  it("follows the event as it is now: a change the app applies shows in the open details", async () => {
    const user = userEvent.setup();
    const { rerender, seen } = renderDetails();
    await user.click(block("Design review"));
    const moved: Booking = { ...REVIEW, start: at(14, 15), end: at(14, 16), room: "5.01" };
    rerender(
      <EventCalendar<Booking>
        aria-label="Bookings"
        events={[moved, INTERVIEW]}
        now={NOW}
        locale="en-US"
        defaultView="week"
        defaultDate={at(15, 0)}
        renderEventDetails={(d) => {
          seen.push(d);
          return <section aria-label={`${d.event.title} details`}>Room {d.event.room}</section>;
        }}
      />,
    );
    expect(details("Design review")).toHaveTextContent("Room 5.01");
    expect(seen.at(-1)?.event).toBe(moved);
  });
});

describe("renderEventDetails' anchor when the pressed element goes", () => {
  it("measures another drawing of the event that has a box, never an undisplayed one, else where it last was", async () => {
    const user = userEvent.setup();
    const { seen } = renderDetails();
    const pressed = block("Design review");
    pressed.getBoundingClientRect = () => new DOMRect(300, 200, 120, 60);
    await user.click(pressed);
    const anchor = seen.at(-1)!.anchor;
    expect(anchor.getBoundingClientRect().x).toBe(300);
    // The pressed element is gone; an undisplayed drawing (0 × 0) and a drawn one remain.
    pressed.remove();
    const hidden = document.createElement("div");
    hidden.dataset.event = "review";
    hidden.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
    const shown = document.createElement("div");
    shown.dataset.event = "review";
    shown.getBoundingClientRect = () => new DOMRect(40, 80, 90, 24);
    // Inside the calendar: the anchor looks for drawings of the event there, nowhere else.
    screen.getByRole("group", { name: "Bookings" }).append(hidden, shown);
    expect(anchor.getBoundingClientRect().x).toBe(40);
    // None drawn now: where it last was.
    shown.remove();
    expect(anchor.getBoundingClientRect().x).toBe(40);
  });
});
