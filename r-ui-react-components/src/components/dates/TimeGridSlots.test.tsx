// West of Greenwich before any local Date is built: a `toISOString()` or UTC
// getter anywhere would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import type { CalendarEvent } from "./event-core";
import { type CalendarRange, describeRange, describeSlot, slotRange } from "./event-edit";
import { DEFAULT_EVENT_CALENDAR_LABELS } from "./event-parts";

/** Thursday 15 October 2026, 10:40 local. The en-US week is Sunday 11 – Saturday 17. */
const NOW = new Date(2026, 9, 15, 10, 40);
const LABELS = DEFAULT_EVENT_CALENDAR_LABELS;
const day = (date: number) => new Date(2026, 9, date);
const at = (date: number, hour: number, minute = 0) => new Date(2026, 9, date, hour, minute);
const slot = (date: number, minute: number) => ({ day: day(date), minute });
const name = (date: number, minute: number) => describeSlot(slot(date, minute), "en-US");

const EVENTS: CalendarEvent[] = [{ id: "interview", title: "Interview", start: at(15, 13), end: at(15, 14) }];

function renderSlots(props: Partial<EventCalendarProps> = {}) {
  const onSelectionChange = vi.fn<(range: CalendarRange | null) => void>();
  const onDateChange = vi.fn<(date: Date) => void>();
  const utils = render(
    <EventCalendar
      aria-label="Ops"
      events={EVENTS}
      now={NOW}
      locale="en-US"
      defaultView="week"
      defaultDate={day(15)}
      onSelectionChange={onSelectionChange}
      onDateChange={onDateChange}
      {...props}
    />,
  );
  return { ...utils, onSelectionChange, onDateChange };
}

const grid = () => screen.getByRole("grid", { name: LABELS.slots });
const activeCell = () => document.getElementById(grid().getAttribute("aria-activedescendant") ?? "");
const activeName = () => activeCell()?.getAttribute("aria-label");
const cell = (date: number, minute: number) =>
  grid().querySelector<HTMLElement>(`[data-slot-day="2026-10-${date}"][data-slot-minute="${minute}"]`)!;
const selectedCells = () => [...grid().querySelectorAll('[role="gridcell"][aria-selected="true"]')];
const pieces = (kind: "draft" | "selection") => [...grid().querySelectorAll(`[data-slots-draft="${kind}"]`)];
const status = () => screen.getByRole("status");

describe("EventCalendar time grid slots", () => {
  it("is one named grid and one tab stop: a row per slot, a gridcell per day, each named by its day and time", () => {
    renderSlots();
    const g = grid();
    expect(g).toHaveAttribute("tabindex", "0");
    expect(g).toHaveAttribute("aria-multiselectable", "true");
    expect(g.querySelectorAll("[tabindex]")).toHaveLength(0);
    const rows = within(g).getAllByRole("row");
    expect(rows).toHaveLength(48);
    expect(within(rows[0]!).getAllByRole("gridcell")).toHaveLength(7);
    expect(within(rows[19]!).getAllByRole("gridcell").map((c) => c.getAttribute("aria-label"))).toEqual(
      [11, 12, 13, 14, 15, 16, 17].map((d) => name(d, 19 * 30)),
    );
    // Ids are unique: the active descendant names one cell.
    const ids = within(g).getAllByRole("gridcell").map((c) => c.id);
    expect(new Set(ids).size).toBe(7 * 48);
    // The cursor starts at scrollToHour (8) on the active day.
    expect(activeName()).toBe(name(15, 480));
    expect(activeCell()).toHaveAttribute("data-active");
    expect(selectedCells()).toHaveLength(0);
  });

  it("moves the cursor by slots, hours and the day's ends, stopping at them, and across days with one onDateChange each", async () => {
    const user = userEvent.setup();
    const { onDateChange, onSelectionChange } = renderSlots();
    grid().focus();
    await user.keyboard("{ArrowDown}");
    expect(activeName()).toBe(name(15, 510));
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(activeName()).toBe(name(15, 450));
    await user.keyboard("{PageDown}");
    expect(activeName()).toBe(name(15, 510));
    await user.keyboard("{PageUp}{PageUp}");
    expect(activeName()).toBe(name(15, 390));
    await user.keyboard("{Home}{ArrowUp}{PageUp}");
    expect(activeName()).toBe(name(15, 0));
    // Held at the edge, not past it: one step back in is one slot.
    await user.keyboard("{ArrowDown}");
    expect(activeName()).toBe(name(15, 30));
    await user.keyboard("{End}{ArrowDown}{PageDown}");
    expect(activeName()).toBe(name(15, 1410));
    await user.keyboard("{ArrowUp}{End}");
    expect(activeName()).toBe(name(15, 1410));
    expect(onDateChange).toHaveBeenCalledTimes(0);

    await user.keyboard("{ArrowRight}");
    expect(activeName()).toBe(name(16, 1410));
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenLastCalledWith(day(16));
    // Saturday is the view's end: the second press stays, and changes no day.
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(activeName()).toBe(name(17, 1410));
    expect(onDateChange).toHaveBeenCalledTimes(2);
    // Six days back to Sunday, then the start stops it.
    await user.keyboard("{ArrowLeft>6/}{ArrowLeft}");
    expect(activeName()).toBe(name(11, 1410));
    expect(onDateChange).toHaveBeenCalledTimes(8);
    expect(onDateChange).toHaveBeenLastCalledWith(day(11));
    // Moving picks nothing.
    expect(onSelectionChange).toHaveBeenCalledTimes(0);
  });

  it("mirrors ArrowLeft / ArrowRight right to left", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    render(
      <div style={{ direction: "rtl" }}>
        <EventCalendar
          events={EVENTS}
          now={NOW}
          locale="en-US"
          defaultView="week"
          defaultDate={day(15)}
          onSelectionChange={() => {}}
          onDateChange={onDateChange}
        />
      </div>,
    );
    grid().focus();
    await user.keyboard("{ArrowLeft}");
    expect(activeName()).toBe(name(16, 480));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(activeName()).toBe(name(14, 480));
    expect(onDateChange).toHaveBeenCalledTimes(3);
  });

  it("extends a draft with Shift across days, and Enter picks it once and says so", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onDateChange } = renderSlots();
    grid().focus();
    await user.keyboard("{Shift>}{ArrowDown}{ArrowRight}{/Shift}");
    expect(activeName()).toBe(`${name(16, 510)}, ${LABELS.inSelection}`);
    expect(onDateChange).toHaveBeenCalledTimes(1);
    // Thursday 08:00 to Friday 09:00: 32 slots on Thursday, 18 on Friday.
    expect(selectedCells()).toHaveLength(50);
    expect(cell(15, 480)).toHaveAttribute("aria-selected", "true");
    expect(cell(15, 480)).toHaveAccessibleName(`${name(15, 480)}, ${LABELS.inSelection}`);
    expect(cell(15, 1410)).toHaveAttribute("aria-selected", "true");
    expect(cell(16, 0)).toHaveAttribute("aria-selected", "true");
    expect(cell(16, 510)).toHaveAttribute("aria-selected", "true");
    expect(cell(15, 450)).toHaveAttribute("aria-selected", "false");
    expect(cell(16, 540)).toHaveAttribute("aria-selected", "false");
    expect(cell(16, 540)).toHaveAccessibleName(name(16, 540));
    // Over midnight: a piece on each day.
    expect(pieces("draft")).toHaveLength(2);
    expect(onSelectionChange).toHaveBeenCalledTimes(0);

    await user.keyboard("{Enter}");
    const range = slotRange(slot(15, 480), slot(16, 510), 30);
    expect(range).toEqual({ start: at(15, 8), end: at(16, 9), allDay: false });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(range);
    expect(status().textContent).toBe(LABELS.selected(describeRange(range, "en-US", LABELS)));
    // The draft is gone; the picked range stays drawn, and its cells selected.
    expect(pieces("draft")).toHaveLength(0);
    expect(pieces("selection")).toHaveLength(2);
    expect(selectedCells()).toHaveLength(50);
  });

  it("drops the draft on a plain move: Shift's anchor is where it was first held", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderSlots();
    grid().focus();
    // Extending past the day's start stays inside the day.
    await user.keyboard("{Home}{Shift>}{ArrowUp}{/Shift}");
    expect(selectedCells()).toEqual([cell(15, 0)]);
    await user.keyboard("{ArrowDown}{ArrowDown>15/}");
    expect(activeName()).toBe(name(15, 480));
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selectedCells()).toHaveLength(2);
    await user.keyboard("{ArrowDown}");
    expect(selectedCells()).toHaveLength(0);
    // A new anchor at 09:00, extended up past it.
    await user.keyboard("{Shift>}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}{Enter}");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(slotRange(slot(15, 540), slot(15, 450), 30));
    expect(onSelectionChange.mock.calls[0]?.[0]).toEqual({ start: at(15, 7, 30), end: at(15, 9, 30), allDay: false });
  });

  it("picks the cursor's one slot with Space", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderSlots();
    grid().focus();
    await user.keyboard("{ArrowDown} ");
    const range = slotRange(slot(15, 510), slot(15, 510), 30);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(range);
    expect(status().textContent).toBe(LABELS.selected(describeRange(range, "en-US", LABELS)));
  });

  it("starts at the picked range's first slot; Escape clears the range once, and only drops a draft otherwise", async () => {
    const user = userEvent.setup();
    const picked = { start: at(13, 14), end: at(13, 15), allDay: false };
    const { onSelectionChange } = renderSlots({ defaultSelection: picked });
    expect(activeName()).toBe(`${name(13, 840)}, ${LABELS.inSelection}`);
    expect(selectedCells()).toHaveLength(2);
    expect(pieces("selection")).toHaveLength(1);

    grid().focus();
    await user.keyboard("{Escape}");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(null);
    expect(status()).toHaveTextContent(LABELS.selectionCleared);
    expect(pieces("selection")).toHaveLength(0);
    // Nothing left to clear: Escape does nothing more.
    await user.keyboard("{Escape}");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    // A draft alone is dropped, with no call.
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(pieces("draft")).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(pieces("draft")).toHaveLength(0);
    expect(selectedCells()).toHaveLength(0);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to the page when there is nothing to drop", async () => {
    const user = userEvent.setup();
    const outside = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && outside()}>
        <EventCalendar
          events={EVENTS}
          now={NOW}
          locale="en-US"
          defaultView="week"
          defaultDate={day(15)}
          defaultSelection={{ start: at(15, 9), end: at(15, 10), allDay: false }}
          onSelectionChange={() => {}}
        />
      </div>,
    );
    grid().focus();
    await user.keyboard("{Escape}");
    expect(outside).toHaveBeenCalledTimes(0);
    await user.keyboard("{Escape}");
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it("picks one slot with a press that does not travel", () => {
    const { onSelectionChange, onDateChange } = renderSlots();
    const target = cell(14, 600);
    fireEvent.pointerDown(target, { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 11, clientY: 10 });
    fireEvent.click(target);
    const range = slotRange(slot(14, 600), slot(14, 600), 30);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(range);
    expect(status().textContent).toBe(LABELS.selected(describeRange(range, "en-US", LABELS)));
    expect(activeName()).toBe(`${name(14, 600)}, ${LABELS.inSelection}`);
    expect(onDateChange).toHaveBeenCalledTimes(0);
  });

  describe("by pointer drag (the grid laid out by hand)", () => {
    /** Days 100px wide from x = 100 (Sunday) and an hour 80px tall from y = 0, as the geometry reads them. */
    function layOut(container: HTMLElement) {
      const rect = (left: number, right: number, top: number) =>
        ({ left, right, top, bottom: top + 1, width: right - left, height: 1, x: left, y: top, toJSON() {} }) as DOMRect;
      const days = [...container.querySelectorAll<HTMLElement>(".r-dates-timegrid-day[data-day]")];
      expect(days).toHaveLength(7);
      days.forEach((el, i) => (el.getBoundingClientRect = () => rect(100 + i * 100, 200 + i * 100, 0)));
      for (const line of container.querySelectorAll<HTMLElement>("[data-hour]")) {
        const hour = Number(line.dataset.hour);
        line.getBoundingClientRect = () => rect(100, 800, hour * 80);
      }
    }
    const down = (el: Element, x: number, y: number) =>
      fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, pointerType: "mouse" });
    const move = (x: number, y: number) => act(() => void fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y }));
    const up = (x: number, y: number) => act(() => void fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y }));

    it("picks from the pressed slot to the one under the pointer, once, on release", () => {
      const { container, onSelectionChange } = renderSlots();
      layOut(container);
      // Thursday is the fifth column (500–600); 10:00 is 800px down.
      const from = cell(15, 600);
      down(from, 550, 805);
      move(550, 860);
      move(550, 925); // 11:33 → the 11:30 slot
      expect(pieces("draft")).toHaveLength(1);
      expect(selectedCells()).toHaveLength(4);
      expect(onSelectionChange).toHaveBeenCalledTimes(0);
      up(550, 925);
      fireEvent.click(from); // the release's click is swallowed
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      expect(onSelectionChange).toHaveBeenCalledWith({ start: at(15, 10), end: at(15, 12), allDay: false });
    });

    it("picks backwards across days, and Escape abandons a drag with no call", () => {
      const { container, onSelectionChange } = renderSlots();
      layOut(container);
      const from = cell(15, 600);
      down(from, 550, 805);
      move(450, 725); // Wednesday 09:03 → the 09:00 slot
      expect(pieces("draft")).toHaveLength(2);
      up(450, 725);
      fireEvent.click(from);
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      expect(onSelectionChange).toHaveBeenCalledWith(slotRange(slot(15, 600), slot(14, 540), 30));
      expect(onSelectionChange.mock.calls[0]?.[0]).toEqual({ start: at(14, 9), end: at(15, 10, 30), allDay: false });

      down(cell(12, 120), 250, 165);
      move(250, 400);
      expect(pieces("draft")).toHaveLength(1);
      act(() => void fireEvent.keyDown(window, { key: "Escape" }));
      expect(pieces("draft")).toHaveLength(0);
      up(250, 400);
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("a new press and the range picked before", () => {
    const picked: CalendarRange = { start: at(14, 9), end: at(14, 10), allDay: false };
    const press = (el: Element) =>
      fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
    /** Lets the press's release settle (what it showed is dropped after its click's turn). */
    const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    it("gives way the moment the press lands, and comes back when the press comes to nothing", async () => {
      renderSlots({ selection: picked });
      expect(pieces("selection")).toHaveLength(1);
      press(cell(15, 600));
      // Before the pointer has moved: only the pressed slot is shown, and only it is selected.
      expect(pieces("selection")).toHaveLength(0);
      expect(pieces("draft")).toHaveLength(1);
      expect(selectedCells()).toEqual([cell(15, 600)]);
      // The browser takes the pointer (a touch turning into a scroll): nothing was picked.
      fireEvent.pointerCancel(window, { pointerId: 1 });
      await settle();
      expect(pieces("draft")).toHaveLength(0);
      expect(pieces("selection")).toHaveLength(1);
    });

    it("is replaced by the pressed slot when the press is a click", async () => {
      const { onSelectionChange } = renderSlots({ defaultSelection: picked });
      const target = cell(15, 600);
      press(target);
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.click(target);
      await settle();
      expect(onSelectionChange.mock.calls).toEqual([[slotRange(slot(15, 600), slot(15, 600), 30)]]);
      expect(pieces("draft")).toHaveLength(0);
      expect(pieces("selection")).toHaveLength(1);
      expect(selectedCells()).toEqual([target]);
    });

    it("hides an all-day range in the all-day row while a pick is under way", async () => {
      const { container } = renderSlots({ selection: { start: day(14), end: day(15), allDay: true } });
      expect(container.querySelector("[data-allday-selection]")).not.toBeNull();
      press(cell(15, 600));
      expect(container.querySelector("[data-allday-selection]")).toBeNull();
      fireEvent.pointerCancel(window, { pointerId: 1 });
      await settle();
      expect(container.querySelector("[data-allday-selection]")).not.toBeNull();
    });
  });

  it("is cleared by opening or moving an event: turning to an event abandons a pick", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    const { onSelectionChange } = renderSlots({ defaultSelection: { start: at(14, 9), end: at(14, 10), allDay: false }, onEventClick });
    await user.click(screen.getByRole("button", { name: /^Interview,/ }));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onSelectionChange.mock.calls).toEqual([[null]]);
    expect(pieces("selection")).toHaveLength(0);
    // With nothing picked, opening an event says nothing about picks.
    await user.click(screen.getByRole("button", { name: /^Interview,/ }));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("follows slotMinutes: 15 and 60 change the rows and the step", async () => {
    const user = userEvent.setup();
    const { unmount } = renderSlots({ slotMinutes: 15 });
    expect(within(grid()).getAllByRole("row")).toHaveLength(96);
    grid().focus();
    await user.keyboard("{ArrowDown}");
    expect(activeName()).toBe(name(15, 495));
    unmount();

    renderSlots({ slotMinutes: 60 });
    expect(within(grid()).getAllByRole("row")).toHaveLength(24);
    grid().focus();
    await user.keyboard("{ArrowDown}{End}");
    expect(activeName()).toBe(name(15, 1380));
  });

  it("shows one column in the day view, where Left and Right stay", async () => {
    const user = userEvent.setup();
    const { onDateChange } = renderSlots({ defaultView: "day" });
    expect(within(within(grid()).getAllByRole("row")[0]!).getAllByRole("gridcell")).toHaveLength(1);
    grid().focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(activeName()).toBe(name(15, 480));
    expect(onDateChange).toHaveBeenCalledTimes(0);
  });

  it("has no slots without onSelectionChange", () => {
    render(<EventCalendar aria-label="Ops" events={EVENTS} now={NOW} locale="en-US" defaultView="week" defaultDate={day(15)} />);
    // The time grid is there (positive control), its slot layer is not.
    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.getByRole("region").querySelectorAll(".r-dates-timegrid-day[data-day]")).toHaveLength(7);
    expect(screen.queryByRole("grid")).toBeNull();
  });
});
