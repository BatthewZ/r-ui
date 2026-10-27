// West of Greenwich before any local Date is built.
process.env.TZ = "America/New_York";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventCalendar, type EventCalendarProps, type EventCalendarSelection } from "./EventCalendar";
import type { CalendarRange } from "./event-edit";

/** Thursday 15 October 2026, 10:40 local. The en-US week is Sunday 11 – Saturday 17. */
const NOW = new Date(2026, 9, 15, 10, 40);
const at = (date: number, hour: number, minute = 0) => new Date(2026, 9, date, hour, minute);
const day = (date: number) => new Date(2026, 9, date);
const OVER_MIDNIGHT: CalendarRange = { start: at(14, 22), end: at(15, 1), allDay: false };

function renderPicking(props: Partial<EventCalendarProps> = {}) {
  const onSelectionChange = vi.fn<(range: CalendarRange | null) => void>();
  const seen: EventCalendarSelection[] = [];
  const utils = render(
    <EventCalendar
      aria-label="Bookings"
      events={[]}
      now={NOW}
      locale="en-US"
      defaultView="week"
      defaultDate={day(15)}
      onSelectionChange={onSelectionChange}
      renderSelection={(selection) => {
        seen.push(selection);
        return (
          <div role="dialog" aria-label="New booking">
            <button type="button" onClick={selection.clear}>
              Cancel
            </button>
          </div>
        );
      }}
      {...props}
    />,
  );
  return { ...utils, onSelectionChange, seen };
}

const panel = () => screen.queryByRole("dialog", { name: "New booking" });

describe("EventCalendar renderSelection", () => {
  it("shows the app's surface while the picked range is drawn, given the range and an anchor at its last piece", async () => {
    const { container, seen } = renderPicking({ selection: OVER_MIDNIGHT });
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(seen.at(-1)?.range).toEqual(OVER_MIDNIGHT);
    // Two pieces over midnight (Wednesday's, then Thursday's): the anchor is the last one.
    const pieces = [...container.querySelectorAll<HTMLElement>("[data-selection-piece]")];
    expect(pieces).toHaveLength(2);
    const box = new DOMRect(500, 0, 100, 80);
    pieces[1]!.getBoundingClientRect = () => box;
    expect(seen.at(-1)?.anchor.getBoundingClientRect()).toBe(box);
    expect(seen.at(-1)?.anchor.contextElement).toBe(pieces[1]);
  });

  it("clears the pick from the surface's own Cancel", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderPicking({ defaultSelection: OVER_MIDNIGHT });
    await waitFor(() => expect(panel()).not.toBeNull());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSelectionChange.mock.calls).toEqual([[null]]);
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("goes while a new pick is pressed, and comes back when that press comes to nothing", async () => {
    const { container } = renderPicking({ selection: OVER_MIDNIGHT });
    await waitFor(() => expect(panel()).not.toBeNull());
    const slot = container.querySelector('[data-slot-day="2026-10-16"][data-slot-minute="600"]')!;
    fireEvent.pointerDown(slot, { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
    await waitFor(() => expect(panel()).toBeNull());
    fireEvent.pointerCancel(window, { pointerId: 1 });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    await waitFor(() => expect(panel()).not.toBeNull());
  });

  it("shows nothing for a range off the period shown, and draws the month's pick too", async () => {
    const elsewhere = renderPicking({ selection: { start: at(20, 9), end: at(20, 10), allDay: false } });
    // Positive control first: the week view's slots are there, the pick just is not in them.
    expect(elsewhere.container.querySelector("[data-slots]")).not.toBeNull();
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    expect(panel()).toBeNull();
    elsewhere.unmount();

    renderPicking({ defaultView: "month", selection: { start: day(20), end: day(22), allDay: true } });
    await waitFor(() => expect(panel()).not.toBeNull());
  });

  it("watches for the drawn pick only with renderSelection", () => {
    const observe = vi.spyOn(MutationObserver.prototype, "observe");
    // This observer, among any others the calendar's parts keep: the one that looks for picks.
    const watchingPicks = () =>
      observe.mock.calls.filter(([, options]) => options?.attributeFilter?.includes("data-selection-piece")).length;
    try {
      const plain = render(
        <EventCalendar aria-label="Plain" events={[]} now={NOW} locale="en-US" defaultView="week" defaultDate={day(15)} selection={OVER_MIDNIGHT} onSelectionChange={() => {}} />,
      );
      expect(watchingPicks()).toBe(0);
      plain.unmount();
      renderPicking({ selection: OVER_MIDNIGHT });
      expect(watchingPicks()).toBe(1);
    } finally {
      observe.mockRestore();
    }
  });
});
