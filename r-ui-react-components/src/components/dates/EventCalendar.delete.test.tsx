// West of Greenwich before any local Date is built.
process.env.TZ = "America/New_York";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import type { CalendarEvent } from "./event-core";

interface Booking extends CalendarEvent {
  room: string;
}

const NOW = new Date(2026, 9, 15, 10, 40);
const at = (date: number, hour: number, minute = 0) => new Date(2026, 9, date, hour, minute);
const STANDUP: Booking = { id: "standup", title: "Stand-up", start: at(15, 9), end: at(15, 9, 30), room: "1.01" };
const REVIEW: Booking = { id: "review", title: "Design review", start: at(15, 10), end: at(15, 11), room: "4.12" };
const RETRO: Booking = { id: "retro", title: "Retro", start: at(15, 15), end: at(15, 16), room: "2.02" };
const HOLIDAY: Booking = { id: "holiday", title: "Public holiday", start: "2026-10-12", editable: false, room: "—" };
const EVENTS = [STANDUP, REVIEW, RETRO, HOLIDAY];

const base: Partial<EventCalendarProps<Booking>> = { now: NOW, locale: "en-US", defaultView: "agenda", defaultDate: at(15, 0) };
const event = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title},`) });

/** The app's side: it removes what it is told to, as the showcase's demo does. */
function App({ onDelete, ...props }: { onDelete: (e: Booking) => void } & Partial<EventCalendarProps<Booking>>) {
  const [events, setEvents] = useState(EVENTS);
  return (
    <EventCalendar<Booking>
      aria-label="Bookings"
      {...base}
      events={events}
      onEventDelete={(e) => {
        onDelete(e);
        setEvents((list) => list.filter((x) => x.id !== e.id));
      }}
      {...props}
    />
  );
}

describe("EventCalendar onEventDelete", () => {
  it("hands your object to Delete or Backspace on a focused event, once a press", async () => {
    const user = userEvent.setup();
    const onEventDelete = vi.fn<(e: Booking) => void>();
    render(<EventCalendar<Booking> aria-label="Bookings" {...base} events={EVENTS} onEventDelete={onEventDelete} />);
    act(() => event("Design review").focus());
    await user.keyboard("{Delete}");
    act(() => event("Retro").focus());
    await user.keyboard("{Backspace}");
    expect(onEventDelete.mock.calls).toEqual([[REVIEW], [RETRO]]);
    // The calendar removes nothing itself.
    expect(event("Design review")).toBeInTheDocument();
  });

  it("makes events buttons that say the key, and leaves an editable: false one alone", async () => {
    const user = userEvent.setup();
    const onEventDelete = vi.fn();
    const { rerender } = render(<EventCalendar<Booking> aria-label="Bookings" {...base} events={EVENTS} onEventDelete={onEventDelete} />);
    // No onEventClick: onEventDelete alone makes the events focusable.
    expect(event("Retro")).toHaveAttribute("aria-keyshortcuts", "Delete Backspace");
    const holiday = event("Public holiday");
    expect(holiday).not.toHaveAttribute("aria-keyshortcuts");
    act(() => holiday.focus());
    await user.keyboard("{Delete}");
    expect(onEventDelete).toHaveBeenCalledTimes(0);
    // Without onEventDelete nothing says the key, and the events are text again.
    rerender(<EventCalendar<Booking> aria-label="Bookings" {...base} events={EVENTS} />);
    expect(screen.queryByRole("button", { name: /^Retro,/ })).toBeNull();
  });

  it("is not a delete with a modifier, held down, inside the app's own field, or for a moving event", async () => {
    const user = userEvent.setup();
    const onEventDelete = vi.fn();
    render(
      <EventCalendar<Booking>
        aria-label="Bookings"
        {...base}
        events={EVENTS}
        onEventDelete={onEventDelete}
        renderEventDetails={() => <input aria-label="Notes" defaultValue="x" />}
      />,
    );
    const retro = event("Retro");
    act(() => retro.focus());
    await user.keyboard("{Shift>}{Delete}{/Shift}{Control>}{Backspace}{/Control}");
    expect(onEventDelete).toHaveBeenCalledTimes(0);
    // Held: the first press deletes, the key's repeats do not (user-event sends no `repeat`).
    await user.keyboard("{Delete}");
    fireEvent.keyDown(retro, { key: "Delete", repeat: true });
    fireEvent.keyDown(retro, { key: "Delete", repeat: true });
    expect(onEventDelete).toHaveBeenCalledTimes(1);
    // Backspace typed in a field the app rendered inside the calendar.
    await user.click(retro);
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "{Backspace}");
    expect(onEventDelete).toHaveBeenCalledTimes(1);
    // An event picked up to move.
    retro.setAttribute("data-moving", "");
    act(() => retro.focus());
    await user.keyboard("{Delete}");
    expect(onEventDelete).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the next event when the app takes the deleted one away", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<App onDelete={onDelete} />);
    act(() => event("Design review").focus());
    await user.keyboard("{Delete}");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^Design review,/ })).toBeNull();
    expect(event("Retro")).toHaveFocus();
    // The last one: the one before it.
    await user.keyboard("{Delete}");
    expect(event("Stand-up")).toHaveFocus();
  });

  it("leaves focus alone when the app refuses", async () => {
    const user = userEvent.setup();
    render(<EventCalendar<Booking> aria-label="Bookings" {...base} events={EVENTS} onEventDelete={() => {}} />);
    act(() => event("Design review").focus());
    await user.keyboard("{Delete}");
    expect(event("Design review")).toHaveFocus();
  });

  it("works from the week's blocks and from the month's day panel", async () => {
    const user = userEvent.setup();
    const onEventDelete = vi.fn<(e: Booking) => void>();
    const { unmount } = render(
      <EventCalendar<Booking> aria-label="Bookings" {...base} defaultView="week" events={EVENTS} onEventDelete={onEventDelete} />,
    );
    act(() => event("Retro").focus());
    await user.keyboard("{Delete}");
    expect(onEventDelete.mock.calls).toEqual([[RETRO]]);
    unmount();

    render(<EventCalendar<Booking> aria-label="Bookings" {...base} defaultView="month" events={EVENTS} onEventDelete={onEventDelete} />);
    const cell = screen.getByRole("gridcell", { name: /Thursday, October 15/ });
    act(() => cell.focus());
    await user.keyboard("{Enter}");
    const panel = screen.getByRole("dialog", { name: "Thursday, October 15" });
    act(() => within(panel).getByRole("button", { name: /^Stand-up,/ }).focus());
    await user.keyboard("{Delete}");
    expect(onEventDelete.mock.calls).toEqual([[RETRO], [STANDUP]]);
  });
});
