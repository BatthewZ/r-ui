// West of Greenwich, before any local Date is built: a `toISOString()` or UTC
// getter would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseISODate, toISODate } from "./date-core";
import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import { type CalendarEvent, daysBetween } from "./event-core";
import type { CalendarEventChange, CalendarRange } from "./event-edit";

/** Thursday 15 October 2026, 10:40 local. */
const NOW = new Date(2026, 9, 15, 10, 40);
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute);
const day = (month: number, date: number) => new Date(2026, month - 1, date);

const EVENTS: CalendarEvent[] = [
  { id: "interview", title: "Interview", start: at(10, 15, 13), end: at(10, 15, 14), slot: 3 },
  { id: "maintenance", title: "Maintenance window", start: "2026-10-06", end: "2026-10-08" },
  { id: "holiday", title: "Public holiday", start: "2026-10-12", editable: false },
  // Friday to Monday: a segment in each of two weeks.
  { id: "oncall", title: "On call", start: "2026-10-23", end: "2026-10-26" },
];

function renderMonth(props: Partial<EventCalendarProps> = {}) {
  const onSelectionChange = vi.fn<(range: CalendarRange | null) => void>();
  const onEventChange = vi.fn<(change: CalendarEventChange) => void>();
  const onEventClick = vi.fn<(event: CalendarEvent) => void>();
  const onDateChange = vi.fn<(date: Date) => void>();
  const view = render(
    <EventCalendar
      aria-label="Bookings"
      locale="en-US"
      events={EVENTS}
      now={NOW}
      defaultView="month"
      onSelectionChange={onSelectionChange}
      onEventChange={onEventChange}
      onEventClick={onEventClick}
      onDateChange={onDateChange}
      {...props}
    />,
  );
  return { ...view, onSelectionChange, onEventChange, onEventClick, onDateChange };
}

const cell = (iso: string) => {
  const found = document.querySelector<HTMLElement>(`[role="gridcell"][data-day="${iso}"]`);
  if (!found) throw new Error(`no cell for ${iso}`);
  return found;
};
const chips = (id: string) => [...document.querySelectorAll<HTMLElement>(`.r-dates-month-chip[data-event="${id}"]`)];
const focusedDay = () => (document.activeElement as HTMLElement | null)?.dataset.day ?? document.activeElement?.tagName;
/** `Intl` spaces its ranges and day periods with thin and narrow no-break spaces. */
const plain = (text: string | null | undefined) => (text ?? "").replace(/\s/g, " ");
const announced = () => plain(document.querySelector("[data-calendar-announcer]")?.textContent);
const allDay = (from: Date, to: Date): CalendarRange => ({ start: from, end: to, allDay: true });
const bands = (kind: string) =>
  [...document.querySelectorAll<HTMLElement>(`.r-dates-month-draft[data-draft="${kind}"]`)].map((b) => ({
    in: b.closest<HTMLElement>('[role="gridcell"]')?.dataset.day,
    col: b.style.getPropertyValue("--r-dates-col"),
    span: b.style.getPropertyValue("--r-dates-span"),
    before: b.hasAttribute("data-continues-before"),
    after: b.hasAttribute("data-continues-after"),
  }));

// ── Pointer geometry: jsdom lays nothing out, so the cells are placed by hand:
// 100px squares, a week per row from y = 100, the grid's first day at the top left.
const SIZE = 100;
const TOP = 100;
function layOutCells() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const first = document.querySelector<HTMLElement>('[role="gridcell"]')?.dataset.day;
    const iso = this.getAttribute("role") === "gridcell" ? this.dataset.day : undefined;
    const i = first && iso ? daysBetween(parseISODate(first) as Date, parseISODate(iso) as Date) : -1;
    const [left, top, size] = i < 0 ? [0, 0, 0] : [(i % 7) * SIZE, TOP + Math.floor(i / 7) * SIZE, SIZE];
    return { left, top, right: left + size, bottom: top + size, width: size, height: size, x: left, y: top, toJSON() {} } as DOMRect;
  });
}
/** The centre of a day's cell, as laid out above. */
const centre = (iso: string) => {
  const r = cell(iso).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const down = (el: Element, iso: string) =>
  fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, pointerType: "mouse", clientX: centre(iso).x, clientY: centre(iso).y });
const moveTo = (iso: string) => fireEvent.pointerMove(window, { pointerId: 1, clientX: centre(iso).x, clientY: centre(iso).y });
const upAt = (iso: string) => fireEvent.pointerUp(window, { pointerId: 1, clientX: centre(iso).x, clientY: centre(iso).y });

afterEach(async () => {
  vi.restoreAllMocks();
  // A drop swallows the click that follows it for one tick: let that tick pass,
  // so the next test's first click is its own.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("EventMonthView: picking days by keyboard", () => {
  it("Shift with arrows draws a range from the anchor across a week's edge, and Enter picks it once", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onDateChange } = renderMonth();
    cell("2026-10-15").focus();
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}");
    // Thursday 15 to Sunday 18: the active day moved on, nothing picked yet.
    expect(focusedDay()).toBe("2026-10-18");
    expect(onDateChange.mock.calls.map(([d]) => toISODate(d))).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
    expect(cell("2026-10-17")).toHaveAttribute("aria-selected", "true");
    expect(cell("2026-10-18")).toHaveAccessibleName("Sunday, October 18, No events, selected");
    expect(bands("pick")).toEqual([
      { in: "2026-10-15", col: "4", span: "3", before: false, after: true },
      { in: "2026-10-18", col: "0", span: "1", before: true, after: false },
    ]);

    await user.keyboard("{Enter}");
    expect(onSelectionChange.mock.calls).toEqual([[allDay(day(10, 15), day(10, 18))]]);
    expect(announced()).toBe("Selected Oct 15 – 18");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The picked range stays drawn until the app clears it.
    expect(bands("pick")).toEqual([]);
    expect(bands("selection")).toHaveLength(2);
    expect(cell("2026-10-15")).toHaveAccessibleName("Thursday, October 15, today, 1 event, selected");
    expect(cell("2026-10-19")).toHaveAttribute("aria-selected", "false");
  });

  it("keeps the range being picked across a month page, and picks it backwards", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderMonth({ defaultDate: day(10, 29) });
    cell("2026-10-29").focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}{PageDown}");
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(focusedDay()).toBe("2026-11-30");
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    // From the anchor (29 October) to the active day (23 November).
    expect(cell("2026-11-01")).toHaveAttribute("aria-selected", "true");
    expect(cell("2026-11-24")).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{Enter}");
    expect(onSelectionChange.mock.calls).toEqual([[allDay(day(10, 29), day(11, 23))]]);

    // A new range starts from where the keyboard is now, and may run backwards.
    await user.keyboard("{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}{Enter}");
    expect(onSelectionChange.mock.calls[1]).toEqual([allDay(day(11, 21), day(11, 23))]);
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
  });

  it("Enter on one day still opens the panel, a range shrunk back to one day included", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderMonth();
    cell("2026-10-15").focus();
    await user.keyboard("{Shift>}{ArrowRight}{ArrowLeft}{/Shift}{Enter}");
    expect(screen.getByRole("dialog", { name: "Thursday, October 15" })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
    // Opening the panel let the one-day range go.
    expect(cell("2026-10-15")).toHaveAttribute("aria-selected", "false");
  });

  it("an arrow without Shift lets the range being picked go", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderMonth();
    cell("2026-10-15").focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}{ArrowRight}");
    expect(document.querySelectorAll('[role="gridcell"][aria-selected="true"]')).toHaveLength(0);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Saturday, October 17" })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
  });

  it("the panel's New event picks its day, closes and hands focus back to the cell", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderMonth();
    await user.click(cell("2026-10-20"));
    const panel = screen.getByRole("dialog", { name: "Tuesday, October 20" });
    await user.click(within(panel).getByRole("button", { name: "New event" }));
    expect(onSelectionChange.mock.calls).toEqual([[allDay(day(10, 20), day(10, 20))]]);
    expect(announced()).toBe("Selected Tuesday, October 20, All day");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(cell("2026-10-20")).toHaveFocus());
    expect(cell("2026-10-20")).toHaveAccessibleName("Tuesday, October 20, No events, selected");
  });

  it("Escape closes an open panel first, then clears the picked range once, then passes through", async () => {
    const user = userEvent.setup();
    // What an enclosing dialog would see: whether the calendar took the Escape.
    const escapes: boolean[] = [];
    const { onSelectionChange } = renderMonth({ defaultSelection: allDay(day(10, 20), day(10, 22)) });
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") escapes.push(event.defaultPrevented);
    };
    document.addEventListener("keydown", onEscape);
    await user.click(cell("2026-10-21"));
    expect(screen.getByRole("dialog", { name: "Wednesday, October 21" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(cell("2026-10-21")).toHaveFocus());
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
    expect(bands("selection")).toHaveLength(1);

    await user.keyboard("{Escape}");
    expect(onSelectionChange.mock.calls).toEqual([[null]]);
    expect(announced()).toBe("Selection cleared");
    expect(bands("selection")).toEqual([]);
    expect(cell("2026-10-21")).toHaveAttribute("aria-selected", "false");
    // Nothing left to clear: the Escape is not the calendar's.
    await user.keyboard("{Escape}");
    document.removeEventListener("keydown", onEscape);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(escapes).toEqual([true, true, false]);
  });

  it("Escape drops a range being picked without a call when nothing is picked", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderMonth();
    cell("2026-10-15").focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(bands("pick")).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(bands("pick")).toEqual([]);
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
  });
});

describe("EventMonthView: the picked range", () => {
  it("names its days and draws one band per week it crosses", () => {
    renderMonth({ defaultSelection: allDay(day(10, 23), day(10, 26)) });
    for (const iso of ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]) {
      expect(cell(iso)).toHaveAttribute("aria-selected", "true");
      expect(cell(iso).getAttribute("aria-label")).toMatch(/, selected$/);
    }
    expect(cell("2026-10-22")).toHaveAttribute("aria-selected", "false");
    expect(cell("2026-10-27")).toHaveAccessibleName("Tuesday, October 27, No events");
    expect(bands("selection")).toEqual([
      { in: "2026-10-23", col: "5", span: "2", before: false, after: true },
      { in: "2026-10-25", col: "0", span: "2", before: true, after: false },
    ]);
  });

  it("a timed range covers the days it touches", () => {
    renderMonth({ defaultSelection: { start: at(10, 20, 22), end: at(10, 21, 1), allDay: false } });
    expect([...document.querySelectorAll('[role="gridcell"][aria-selected="true"]')].map((c) => c.getAttribute("data-day"))).toEqual([
      "2026-10-20",
      "2026-10-21",
    ]);
    expect(bands("selection")).toEqual([{ in: "2026-10-20", col: "2", span: "2", before: false, after: false }]);
  });

  it("without onSelectionChange: no New event, no picking, no selected state, nothing drawn", async () => {
    const user = userEvent.setup();
    renderMonth({ onSelectionChange: undefined, defaultSelection: allDay(day(10, 20), day(10, 22)) });
    // A positive control first: the selection given is not drawn, and no cell claims a state.
    expect(cell("2026-10-21")).not.toHaveAttribute("aria-selected");
    expect(document.querySelectorAll(".r-dates-month-draft")).toHaveLength(0);

    cell("2026-10-15").focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(document.querySelectorAll(".r-dates-month-draft")).toHaveLength(0);
    await user.keyboard("{Enter}");
    const panel = screen.getByRole("dialog", { name: "Friday, October 16" });
    expect(within(panel).getByRole("button", { name: "Open day" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "New event" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    // A drag across days draws nothing either.
    layOutCells();
    down(cell("2026-10-20"), "2026-10-20");
    moveTo("2026-10-22");
    expect(document.querySelectorAll(".r-dates-month-draft")).toHaveLength(0);
    upAt("2026-10-22");
  });
});

describe("EventMonthView: picking and moving by pointer", () => {
  it("a drag across three days picks them once; the release's click opens no panel", () => {
    layOutCells();
    const { onSelectionChange } = renderMonth();
    down(cell("2026-10-20"), "2026-10-20");
    moveTo("2026-10-21");
    moveTo("2026-10-22");
    expect(bands("pick")).toEqual([{ in: "2026-10-20", col: "2", span: "3", before: false, after: false }]);
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
    upAt("2026-10-22");
    fireEvent.click(cell("2026-10-20"));
    expect(onSelectionChange.mock.calls).toEqual([[allDay(day(10, 20), day(10, 22))]]);
    expect(announced()).toBe("Selected Oct 20 – 22");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bands("pick")).toEqual([]);
  });

  it("a drag back over a week's edge picks in reading order", () => {
    layOutCells();
    const { onSelectionChange } = renderMonth();
    down(cell("2026-10-22"), "2026-10-22");
    moveTo("2026-10-13");
    upAt("2026-10-13");
    expect(onSelectionChange.mock.calls).toEqual([[allDay(day(10, 13), day(10, 22))]]);
  });

  it("a press without a drag still opens the day's panel", () => {
    layOutCells();
    const { onSelectionChange } = renderMonth();
    down(cell("2026-10-20"), "2026-10-20");
    upAt("2026-10-20");
    fireEvent.click(cell("2026-10-20"));
    expect(screen.getByRole("dialog", { name: "Tuesday, October 20" })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
  });

  it("a chip drags to another day keeping its time, faded where it was until the drop", () => {
    layOutCells();
    const { onEventChange, onEventClick, onSelectionChange } = renderMonth();
    const [chip] = chips("interview");
    expect(chip?.querySelector(".r-dates-month-grip")).toBeNull();
    down(chip as HTMLElement, "2026-10-15");
    moveTo("2026-10-19");
    expect(chip).toHaveAttribute("data-moving");
    expect(bands("move")).toEqual([{ in: "2026-10-19", col: "1", span: "1", before: false, after: false }]);
    upAt("2026-10-19");
    fireEvent.click(chip as HTMLElement);
    expect(onEventChange.mock.calls).toEqual([
      [{ event: EVENTS[0], kind: "move", start: at(10, 19, 13), end: at(10, 19, 14), allDay: false }],
    ]);
    expect(announced()).toBe("Interview moved to Monday, October 19, 1:00 – 2:00 PM");
    expect(chip).not.toHaveAttribute("data-moving");
    expect(onEventClick).toHaveBeenCalledTimes(0);
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
  });

  it("a bar pressed on its second day lands with that day under the pointer", () => {
    layOutCells();
    const { onEventChange } = renderMonth();
    const [bar] = chips("maintenance");
    down(bar as HTMLElement, "2026-10-07");
    moveTo("2026-10-14");
    upAt("2026-10-14");
    expect(onEventChange.mock.calls).toEqual([[{ event: EVENTS[1], kind: "move", ...allDay(day(10, 13), day(10, 15)) }]]);
  });

  it("a drop where it started, or a cancelled drag, changes nothing", () => {
    layOutCells();
    const { onEventChange } = renderMonth();
    const [chip] = chips("interview");
    down(chip as HTMLElement, "2026-10-15");
    moveTo("2026-10-16");
    moveTo("2026-10-15");
    upAt("2026-10-15");
    down(chip as HTMLElement, "2026-10-15");
    moveTo("2026-10-16");
    fireEvent.keyDown(window, { key: "Escape" });
    upAt("2026-10-16");
    expect(onEventChange).toHaveBeenCalledTimes(0);
    expect(bands("move")).toEqual([]);
  });

  it("an all-day bar's grip drags its last day; only the segment it ends in has one", () => {
    layOutCells();
    const { onEventChange } = renderMonth();
    const [first, second] = chips("oncall");
    expect(first?.querySelector(".r-dates-month-grip")).toBeNull();
    expect(second?.querySelector(".r-dates-month-grip")).not.toBeNull();

    const grip = chips("maintenance")[0]?.querySelector(".r-dates-month-grip") as HTMLElement;
    expect(grip).toHaveAttribute("aria-hidden", "true");
    down(grip, "2026-10-08");
    moveTo("2026-10-10");
    expect(grip).toHaveAttribute("data-active");
    expect(bands("resize")).toEqual([{ in: "2026-10-06", col: "2", span: "5", before: false, after: false }]);
    upAt("2026-10-10");
    expect(onEventChange.mock.calls).toEqual([[{ event: EVENTS[1], kind: "resize", ...allDay(day(10, 6), day(10, 10)) }]]);
  });

  it("an editable: false event and every event without onEventChange stay put", () => {
    layOutCells();
    const { onEventChange, onSelectionChange, unmount } = renderMonth();
    const [holiday] = chips("holiday");
    expect(holiday?.querySelector(".r-dates-month-grip")).toBeNull();
    down(holiday as HTMLElement, "2026-10-12");
    moveTo("2026-10-14");
    expect(holiday).not.toHaveAttribute("data-moving");
    upAt("2026-10-14");
    expect(onEventChange).toHaveBeenCalledTimes(0);
    // Its press is its own: no days were picked from it either.
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
    unmount();

    const without = renderMonth({ onEventChange: undefined });
    const [chip] = chips("interview");
    expect(document.querySelectorAll(".r-dates-month-grip")).toHaveLength(0);
    down(chip as HTMLElement, "2026-10-15");
    moveTo("2026-10-19");
    expect(chip).not.toHaveAttribute("data-moving");
    upAt("2026-10-19");
    expect(bands("move")).toEqual([]);
    expect(without.onSelectionChange).toHaveBeenCalledTimes(0);
  });

  it("a chip press without a drag calls onEventClick once and moves nothing", () => {
    layOutCells();
    const { onEventChange, onEventClick } = renderMonth();
    const [chip] = chips("interview");
    down(chip as HTMLElement, "2026-10-15");
    upAt("2026-10-15");
    fireEvent.click(chip as HTMLElement);
    expect(onEventClick.mock.calls.map(([e]) => e.id)).toEqual(["interview"]);
    expect(onEventChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
