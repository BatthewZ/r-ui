// West of Greenwich before any local Date is built: a `toISOString()` or UTC
// getter anywhere would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toISODate } from "./date-core";
import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import { type CalendarEvent, placeEvents } from "./event-core";
import {
  type CalendarEventChange,
  type CalendarRange,
  describeRange,
  moveByDays,
  moveToSlot,
  resizeToDay,
  resizeToSlot,
} from "./event-edit";
import { DEFAULT_EVENT_CALENDAR_LABELS } from "./event-parts";

/** Thursday 15 October 2026, 10:40 local. The en-US week is Sunday 11 – Saturday 17. */
const NOW = new Date(2026, 9, 15, 10, 40);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const oct = (day: number) => new Date(2026, 9, day);

const EVENTS: CalendarEvent[] = [
  { id: "standup", title: "Stand-up", start: at(13, 9, 30), end: at(13, 9, 45) },
  { id: "review", title: "Design review", start: at(14, 10), end: at(14, 11, 30) },
  { id: "interview", title: "Interview", start: at(15, 13), end: at(15, 14) },
  // Friday night into Saturday: a block on each day.
  { id: "migration", title: "Migration", start: at(16, 23), end: at(17, 2, 30) },
  { id: "offsite", title: "Team offsite", start: "2026-10-15", end: "2026-10-16" },
  // Timed, but a day or longer: it sits in the all-day row.
  { id: "conference", title: "Conference", start: at(12, 9), end: at(13, 12) },
  { id: "holiday", title: "Public holiday", start: "2026-10-12", editable: false },
];
const placed = (id: string) => placeEvents(EVENTS).find((p) => p.event.id === id)!;
const event = (id: string) => EVENTS.find((e) => e.id === id)!;

const LABELS = DEFAULT_EVENT_CALENDAR_LABELS;
const said = (range: CalendarRange) => describeRange(range, "en-US", LABELS);

function renderGrid(props: Partial<EventCalendarProps> = {}) {
  return render(
    <EventCalendar
      aria-label="Bookings"
      events={EVENTS}
      now={NOW}
      locale="en-US"
      defaultView="week"
      defaultDate={oct(15)}
      onEventClick={() => {}}
      {...props}
    />,
  );
}

/** A change in `CalendarEvent`'s terms, as an app writes it back. */
const placeOf = (r: CalendarRange): Pick<CalendarEvent, "start" | "end"> =>
  r.allDay ? { start: toISODate(r.start), end: toISODate(r.end) } : { start: r.start, end: r.end };

/** The app's side, as the showcase's demo does it: it applies every change it is told of. */
function App({ onChange, ...props }: { onChange: (change: CalendarEventChange) => void } & Partial<EventCalendarProps>) {
  const [events, setEvents] = useState(EVENTS);
  return (
    <EventCalendar
      aria-label="Bookings"
      events={events}
      now={NOW}
      locale="en-US"
      defaultView="week"
      defaultDate={oct(15)}
      onEventClick={() => {}}
      onEventChange={(change) => {
        onChange(change);
        setEvents((list) => list.map((e) => (e.id === change.event.id ? { ...e, ...placeOf(change) } : e)));
      }}
      {...props}
    />
  );
}

const region = () => screen.getByRole("region");
const body = () => region().querySelector<HTMLElement>(".r-dates-timegrid-body")!;
const column = (iso: string) => body().querySelector<HTMLElement>(`.r-dates-timegrid-day[data-day="${iso}"]`)!;
const block = (iso: string, id: string) => column(iso).querySelector<HTMLElement>(`[data-event="${id}"]`)!;
const bar = (id: string) => region().querySelector<HTMLElement>(`[data-allday] [data-event="${id}"]`)!;
const drafts = () => [...region().querySelectorAll<HTMLElement>("[data-draft]")];
const status = () => screen.getByRole("status");
const prop = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);
const grip = (el: HTMLElement) => el.querySelector<HTMLElement>("[data-grip]");

/**
 * Lays the grid out by hand, as time-grid-geometry.test.ts does: the seven day
 * columns 100px wide from x = 100 (Sunday) and an hour 60px tall from y = 0, so
 * a pointer's y is its minute of the day.
 */
function layOut() {
  const rect = (left: number, right: number, top: number) =>
    ({ left, right, top, bottom: top + 1, width: right - left, height: 1, x: left, y: top, toJSON() {} }) as DOMRect;
  body()
    .querySelectorAll<HTMLElement>(".r-dates-timegrid-day[data-day]")
    .forEach((el, i) => {
      el.getBoundingClientRect = () => rect(100 + 100 * i, 200 + 100 * i, 0);
    });
  for (const hour of [0, 1]) body().querySelector<HTMLElement>(`[data-hour="${hour}"]`)!.getBoundingClientRect = () => rect(0, 900, hour * 60);
}
/** The x at the middle of a day's column (Sunday the 11th is the first). */
const xOf = (day: number) => 150 + 100 * (day - 11);

const pointer = { pointerId: 1, isPrimary: true, button: 0, pointerType: "mouse" };
const press = (el: HTMLElement, x: number, y: number) => fireEvent.pointerDown(el, { ...pointer, clientX: x, clientY: y });
const moveTo = (x: number, y: number) => fireEvent.pointerMove(window, { ...pointer, clientX: x, clientY: y });
const release = (x: number, y: number) => fireEvent.pointerUp(window, { ...pointer, clientX: x, clientY: y });

// A drag's release swallows the next click for a tick: let it pass between tests.
afterEach(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("EventTimeGrid editing by keys", () => {
  it("picks a block up with Space, moves it by slots, drops it with Enter: one change, said in full", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    const onEventClick = vi.fn();
    renderGrid({ onEventChange, onEventClick });
    const interview = block("2026-10-15", "interview");
    interview.focus();

    await user.keyboard(" ");
    expect(status()).toHaveTextContent(LABELS.grabbed("Interview"));
    expect(interview).toHaveAttribute("data-moving");
    // The draft starts where the block is.
    expect(drafts()).toHaveLength(1);
    expect(drafts()[0]!.closest("[data-day]")).toHaveAttribute("data-day", "2026-10-15");
    expect(prop(drafts()[0]!, "--r-dates-start")).toBe("780");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    // The block keeps focus and stays put; the draft shows the target.
    expect(document.activeElement).toBe(interview);
    expect(prop(interview, "--r-dates-start")).toBe("780");
    expect([prop(drafts()[0]!, "--r-dates-start"), prop(drafts()[0]!, "--r-dates-end")]).toEqual(["840", "900"]);
    expect(drafts()[0]).toHaveAttribute("data-draft", "move");
    expect(onEventChange).toHaveBeenCalledTimes(0);

    await user.keyboard("{Enter}");
    const range = moveToSlot(placed("interview"), { day: oct(15), minute: 840 });
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("interview"), kind: "move", ...range });
    expect(range.start).toEqual(at(15, 14));
    expect(status().textContent).toBe(LABELS.dropped("Interview", said(range)));
    expect(drafts()).toHaveLength(0);
    expect(interview).not.toHaveAttribute("data-moving");
    // Neither Space nor the drop's Enter pressed the button.
    expect(onEventClick).toHaveBeenCalledTimes(0);
  });

  it("moves a day with ArrowRight, keeping the time", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    block("2026-10-15", "interview").focus();
    await user.keyboard(" {ArrowRight}");
    expect(drafts().map((d) => d.closest("[data-day]")?.getAttribute("data-day"))).toEqual(["2026-10-16"]);
    await user.keyboard("{Enter}");
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("interview"), kind: "move", ...moveByDays(placed("interview"), 1) });
  });

  it("mirrors ArrowLeft / ArrowRight right to left", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(
      <div style={{ direction: "rtl" }}>
        <EventCalendar
          aria-label="Bookings"
          events={EVENTS}
          now={NOW}
          locale="en-US"
          defaultView="week"
          defaultDate={oct(15)}
          onEventClick={() => {}}
          onEventChange={onEventChange}
        />
      </div>,
    );
    block("2026-10-15", "interview").focus();
    await user.keyboard(" {ArrowLeft}{Enter}");
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("interview"), kind: "move", ...moveByDays(placed("interview"), 1) });
    block("2026-10-15", "interview").focus();
    await user.keyboard(" {ArrowRight}{Enter}");
    expect(onEventChange).toHaveBeenCalledTimes(2);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("interview"), kind: "move", ...moveByDays(placed("interview"), -1) });
  });

  it("changes a block's end with Shift+ArrowDown / ArrowUp, a slot at least, as a resize", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    block("2026-10-15", "interview").focus();
    // Up twice from an hour: half an hour is one slot, the shortest it gets.
    await user.keyboard(" {Shift>}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}");
    expect([prop(drafts()[0]!, "--r-dates-start"), prop(drafts()[0]!, "--r-dates-end")]).toEqual(["780", "810"]);
    expect(drafts()[0]).toHaveAttribute("data-draft", "resize");
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{/Shift}{Enter}");
    const range = resizeToSlot(placed("interview"), { day: oct(15), minute: 870 }, 30);
    expect(range.end).toEqual(at(15, 15));
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("interview"), kind: "resize", ...range });
  });

  it("puts it back on Escape, on leaving it, and on a drop where it started: no change, said", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    const interview = block("2026-10-15", "interview");
    interview.focus();

    await user.keyboard(" {ArrowDown}{Escape}");
    expect(status()).toHaveTextContent(LABELS.cancelled("Interview"));
    expect(drafts()).toHaveLength(0);
    expect(interview).not.toHaveAttribute("data-moving");

    await user.keyboard(" {ArrowDown}");
    expect(drafts()).toHaveLength(1);
    await user.tab();
    expect(document.activeElement).not.toBe(interview);
    expect(drafts()).toHaveLength(0);
    expect(status()).toHaveTextContent(LABELS.cancelled("Interview"));

    interview.focus();
    await user.keyboard(" ");
    expect(status()).toHaveTextContent(LABELS.grabbed("Interview"));
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(status()).toHaveTextContent(LABELS.cancelled("Interview"));
    expect(onEventChange).toHaveBeenCalledTimes(0);
  });

  it("keeps Enter the block's press until it is picked up, and arrows the roving tab stop's", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    renderGrid({ onEventChange: () => {}, onEventClick });
    block("2026-10-15", "interview").focus();
    await user.keyboard("{Enter}");
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenLastCalledWith(event("interview"));
    expect(drafts()).toHaveLength(0);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(block("2026-10-15", "interview"));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(block("2026-10-14", "review"));
  });

  it("moves an all-day bar by days and its last day with Shift; a long timed bar by days only, keeping its time", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    bar("offsite").focus();
    await user.keyboard(" {ArrowRight}");
    expect(drafts()).toHaveLength(1);
    expect(drafts()[0]!.style.gridColumn).toBe("7 / span 2");
    await user.keyboard("{Enter}");
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("offsite"), kind: "move", ...moveByDays(placed("offsite"), 1) });

    bar("offsite").focus();
    await user.keyboard(" {Shift>}{ArrowRight}{/Shift}{Enter}");
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("offsite"), kind: "resize", ...resizeToDay(placed("offsite"), oct(17)) });

    bar("conference").focus();
    await user.keyboard(" {Shift>}{ArrowRight}{/Shift}{ArrowUp}");
    // Neither its end nor its time moves by keys.
    expect(drafts()[0]!.style.gridColumn).toBe("3 / span 2");
    await user.keyboard("{ArrowRight}{Enter}");
    const range = moveByDays(placed("conference"), 1);
    expect(range.start).toEqual(at(13, 9));
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("conference"), kind: "move", ...range });
    expect(onEventChange).toHaveBeenCalledTimes(3);
  });

  it("describes what can move, and leaves events that cannot (editable: false, no onEventChange) as they were", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    const onEventClick = vi.fn();
    const { unmount } = renderGrid({ onEventChange, onEventClick });
    expect(block("2026-10-15", "interview")).toHaveAccessibleDescription(LABELS.editHint);
    expect(bar("offsite")).toHaveAccessibleDescription(LABELS.editHint);
    expect(grip(block("2026-10-15", "interview"))).toHaveAttribute("aria-hidden", "true");
    expect(grip(bar("offsite"))).not.toBeNull();

    const holiday = bar("holiday");
    expect(holiday).not.toHaveAttribute("aria-describedby");
    expect(grip(holiday)).toBeNull();
    holiday.focus();
    await user.keyboard(" ");
    // Space is the button's own press: nothing picked up.
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(drafts()).toHaveLength(0);
    expect(status()).toBeEmptyDOMElement();
    await user.keyboard("{ArrowRight}{Enter}");
    // Enter is its press too.
    expect(onEventClick).toHaveBeenCalledTimes(2);
    expect(drafts()).toHaveLength(0);
    expect(onEventChange).toHaveBeenCalledTimes(0);
    unmount();

    renderGrid({ onEventClick });
    const interview = block("2026-10-15", "interview");
    expect(interview).not.toHaveAttribute("aria-describedby");
    expect(region().querySelectorAll("[data-grip]")).toHaveLength(0);
    interview.focus();
    await user.keyboard(" ");
    expect(drafts()).toHaveLength(0);
    expect(status()).toBeEmptyDOMElement();
    // Space is the button's own press here.
    expect(onEventClick).toHaveBeenCalledTimes(3);
  });

  it("gives focus back to the moved event once the app has moved it to another day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<App onChange={onChange} />);
    block("2026-10-15", "interview").focus();
    await user.keyboard(" {ArrowRight}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    // Redrawn on Friday, at 13:30, with focus.
    expect(column("2026-10-15").querySelector('[data-event="interview"]')).toBeNull();
    const moved = block("2026-10-16", "interview");
    expect(prop(moved, "--r-dates-start")).toBe("810");
    expect(document.activeElement).toBe(moved);
    // The roving tab stop followed it.
    expect(moved).toHaveAttribute("tabindex", "0");
  });
});

describe("EventTimeGrid editing by pointer", () => {
  it("moves a block to the slot under the pointer, held where it was pressed, with a draft and the source faded", () => {
    const onEventChange = vi.fn();
    const onEventClick = vi.fn();
    renderGrid({ onEventChange, onEventClick });
    layOut();
    const interview = block("2026-10-15", "interview");
    // Pressed 40 minutes into the 13:00 block: held one slot below its start.
    press(interview, xOf(15), 13 * 60 + 40);
    moveTo(xOf(16), 15 * 60 + 40);
    expect(interview).toHaveAttribute("data-moving");
    expect(drafts()).toHaveLength(1);
    expect(drafts()[0]!.closest("[data-day]")).toHaveAttribute("data-day", "2026-10-16");
    expect([prop(drafts()[0]!, "--r-dates-start"), prop(drafts()[0]!, "--r-dates-end")]).toEqual(["900", "960"]);
    release(xOf(16), 15 * 60 + 40);
    const range = moveToSlot(placed("interview"), { day: oct(16), minute: 900 });
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("interview"), kind: "move", ...range });
    expect(status().textContent).toBe(LABELS.dropped("Interview", said(range)));
    expect(drafts()).toHaveLength(0);
    // The release's click does not also press the block.
    fireEvent.click(interview);
    expect(onEventClick).toHaveBeenCalledTimes(0);
  });

  it("moves a block that began the day before by its real start, onto that day when the pointer asks", () => {
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    layOut();
    // Saturday's part runs 00:00–02:30; the event began Friday 23:00. Pressed at 01:00.
    press(block("2026-10-17", "migration"), xOf(17), 60);
    moveTo(xOf(17), 90);
    // Half an hour later: the start is Friday 23:30, so the draft is on both days.
    expect(drafts().map((d) => [d.closest("[data-day]")?.getAttribute("data-day"), prop(d, "--r-dates-start")])).toEqual([
      ["2026-10-16", "1410"],
      ["2026-10-17", "0"],
    ]);
    release(xOf(17), 90);
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({
      event: event("migration"),
      kind: "move",
      ...moveToSlot(placed("migration"), { day: oct(16), minute: 1410 }),
    });
  });

  it("resizes a block by its bottom grip to the slot under the pointer", () => {
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    layOut();
    const review = block("2026-10-14", "review");
    press(grip(review)!, xOf(14), 11 * 60 + 20);
    moveTo(xOf(14), 12 * 60 + 10);
    expect([prop(drafts()[0]!, "--r-dates-start"), prop(drafts()[0]!, "--r-dates-end")]).toEqual(["600", "750"]);
    release(xOf(14), 12 * 60 + 10);
    const range = resizeToSlot(placed("review"), { day: oct(14), minute: 720 }, 30);
    expect(range.end).toEqual(at(14, 12, 30));
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("review"), kind: "resize", ...range });
  });

  it("resizes a block past midnight, but never a day long (that would make it an all-day bar)", () => {
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    layOut();
    press(grip(block("2026-10-15", "interview"))!, xOf(15), 13 * 60 + 50);
    // Friday 01:10: the slot 01:00–01:30 ends it, over midnight.
    moveTo(xOf(16), 70);
    const days = () => drafts().map((d) => [d.closest("[data-day]")?.getAttribute("data-day"), prop(d, "--r-dates-start"), prop(d, "--r-dates-end")]);
    expect(days()).toEqual([
      ["2026-10-15", "780", "1440"],
      ["2026-10-16", "0", "90"],
    ]);
    // Friday 14:00 would be 25 hours long: the draft stays where it was.
    moveTo(xOf(16), 14 * 60);
    expect(days()).toEqual([
      ["2026-10-15", "780", "1440"],
      ["2026-10-16", "0", "90"],
    ]);
    release(xOf(16), 14 * 60);
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({
      event: event("interview"),
      kind: "resize",
      ...resizeToSlot(placed("interview"), { day: oct(16), minute: 60 }, 30),
    });
  });

  it("moves an all-day bar by the days the pointer crosses, and resizes its last day by its end grip", () => {
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    layOut();
    // Pressed on its second day (Friday), dropped on Saturday: one day later, Friday and Saturday.
    press(bar("offsite"), xOf(16), 0);
    moveTo(xOf(17), 0);
    expect(drafts().map((d) => d.style.gridColumn)).toEqual(["7 / span 2"]);
    release(xOf(17), 0);
    expect(onEventChange).toHaveBeenCalledTimes(1);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("offsite"), kind: "move", ...moveByDays(placed("offsite"), 1) });

    press(grip(bar("offsite"))!, xOf(16), 0);
    moveTo(xOf(17), 0);
    release(xOf(17), 0);
    expect(onEventChange).toHaveBeenCalledTimes(2);
    expect(onEventChange).toHaveBeenLastCalledWith({ event: event("offsite"), kind: "resize", ...resizeToDay(placed("offsite"), oct(17)) });
  });

  it("is a click without a drag, and a drop where it started changes nothing", () => {
    const onEventChange = vi.fn();
    const onEventClick = vi.fn();
    renderGrid({ onEventChange, onEventClick });
    layOut();
    const interview = block("2026-10-15", "interview");
    press(interview, xOf(15), 13 * 60 + 10);
    release(xOf(15), 13 * 60 + 10);
    fireEvent.click(interview);
    expect(onEventClick).toHaveBeenCalledTimes(1);

    press(interview, xOf(15), 13 * 60 + 10);
    moveTo(xOf(15), 13 * 60 + 20);
    expect(drafts()).toHaveLength(1);
    release(xOf(15), 13 * 60 + 20);
    expect(onEventChange).toHaveBeenCalledTimes(0);
    expect(drafts()).toHaveLength(0);
  });

  it("cancels on Escape, and never drags an event that cannot move", () => {
    const onEventChange = vi.fn();
    renderGrid({ onEventChange });
    layOut();
    press(block("2026-10-15", "interview"), xOf(15), 13 * 60);
    moveTo(xOf(16), 13 * 60);
    expect(drafts()).toHaveLength(1);
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    release(xOf(16), 13 * 60);
    expect(drafts()).toHaveLength(0);
    expect(onEventChange).toHaveBeenCalledTimes(0);

    press(bar("holiday"), xOf(12), 0);
    moveTo(xOf(14), 0);
    expect(drafts()).toHaveLength(0);
    release(xOf(14), 0);
    expect(onEventChange).toHaveBeenCalledTimes(0);
    expect(within(region()).getByRole("button", { name: /^Public holiday/ })).not.toHaveAttribute("data-moving");
  });

  it("picks up an event that is neither a link nor clickable, when it can be moved", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn<(change: CalendarEventChange) => void>();
    // No onEventClick: the events would be text, which takes no focus, but these can be moved.
    renderGrid({ onEventClick: undefined, onEventChange });
    const interview = screen.getByRole("button", { name: /^Interview,/ });
    act(() => interview.focus());
    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onEventChange.mock.calls).toEqual([[{ event: event("interview"), kind: "move", ...moveToSlot(placed("interview"), { day: oct(15), minute: 13 * 60 + 30 }) }]]);
    // Without onEventChange those same events are text again.
    renderGrid({ onEventClick: undefined });
    expect(screen.getAllByRole("button", { name: /^Interview,/ })).toHaveLength(1);
  });
});

describe("the all-day row and a picked range", () => {
  it("draws an all-day selection across its days in this week, squared where it goes on past it, and no timed one", () => {
    const view = renderGrid({ selection: { start: oct(16), end: oct(19), allDay: true }, onSelectionChange: () => {} });
    const band = view.container.querySelector<HTMLElement>("[data-allday-selection]");
    // Friday and Saturday of the Sunday-first week, going on into the next.
    expect(band?.style.gridColumn).toBe("7 / span 2");
    expect(band).toHaveAttribute("data-continues-after");
    expect(band).not.toHaveAttribute("data-continues-before");
    view.unmount();

    const timed = renderGrid({ selection: { start: at(15, 10), end: at(15, 11), allDay: false }, onSelectionChange: () => {} });
    expect(timed.container.querySelector("[data-allday-selection]")).toBeNull();
    timed.unmount();

    const elsewhere = renderGrid({ selection: { start: oct(20), end: oct(22), allDay: true }, onSelectionChange: () => {} });
    expect(elsewhere.container.querySelector("[data-allday-selection]")).toBeNull();
  });
});
