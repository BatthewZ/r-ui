// West of Greenwich before any local Date is built: a `toISOString()` or UTC
// getter anywhere would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import { type CalendarEvent, placeEvents } from "./event-core";
import { DEFAULT_EVENT_CALENDAR_LABELS, eventName } from "./event-parts";

/** Thursday 15 October 2026, 10:40 local. The en-US week is Sunday 11 – Saturday 17. */
const NOW = new Date(2026, 9, 15, 10, 40);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

const EVENTS: CalendarEvent[] = [
  { id: "standup-12", title: "Stand-up", start: at(12, 9, 30), end: at(12, 9, 45), slot: 1, category: "Platform team" },
  { id: "plan", title: "Sprint planning", start: at(13, 14), end: at(13, 15) },
  { id: "standup-15", title: "Stand-up", start: at(15, 9, 30), end: at(15, 9, 45), slot: 1, category: "Platform team" },
  // Thursday: three that overlap, side by side.
  { id: "review", title: "Incident review", start: at(15, 10), end: at(15, 11), location: "Room 4.12" },
  { id: "sync", title: "Design sync", start: at(15, 10, 30), end: at(15, 11, 30), slot: 6 },
  { id: "one-on-one", title: "1:1 with Lin", start: at(15, 10, 30), end: at(15, 11) },
  { id: "capacity", title: "Capacity planning", start: at(15, 15), end: at(15, 16, 30), href: "/ops/capacity" },
  // Friday night into Saturday.
  { id: "migration", title: "Database migration", start: at(16, 23), end: at(17, 2, 30), tone: "warning", statusLabel: "Needs sign-off" },
  // All day.
  { id: "oncall", title: "On call: Ada", start: "2026-10-12", end: "2026-10-18", category: "On call" },
  { id: "holiday", title: "Office closed", start: "2026-10-11" },
];

/** A crowded Wednesday: with the on-call week, five all-day events on one day. */
const CROWD: CalendarEvent[] = ["a", "b", "c", "d"].map((id) => ({ id: `wed-${id}`, title: `Wednesday ${id}`, start: "2026-10-14" }));

const LABELS = DEFAULT_EVENT_CALENDAR_LABELS;

function renderGrid(props: Partial<EventCalendarProps> = {}) {
  return render(
    <EventCalendar
      aria-label="Ops"
      events={EVENTS}
      now={NOW}
      locale="en-US"
      defaultView="week"
      defaultDate={new Date(2026, 9, 15)}
      {...props}
    />,
  );
}

const region = () => screen.getByRole("region");
const column = (iso: string) => region().querySelector<HTMLElement>(`.r-dates-timegrid-body [data-day="${iso}"]`)!;
const block = (iso: string, id: string) => column(iso).querySelector<HTMLElement>(`[data-event="${id}"]`)!;
const blocks = () => [...region().querySelectorAll<HTMLElement>("[data-block]")];
const prop = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);
/** A day header button's name (it is labelled by its own hidden text). */
const headName = (b: HTMLElement) => document.getElementById(b.getAttribute("aria-labelledby") ?? "")?.textContent;
const focusedEvent = () => (document.activeElement as HTMLElement | null)?.dataset.block;

describe("EventCalendar time grid", () => {
  it("is a named, focusable region: the week's title, seven day columns", () => {
    renderGrid();
    const r = screen.getByRole("region", { name: /^Oct 11\s–\s17, 2026$/ });
    expect(r).toHaveAttribute("tabindex", "0");
    expect([...r.querySelectorAll(".r-dates-timegrid-body [data-day]")].map((d) => d.getAttribute("data-day"))).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
  });

  it("heads each day with its weekday and number, today's number in the accent badge and said in its name", () => {
    renderGrid();
    const heads = within(region()).getAllByRole("button", { name: /^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day, October \d+/ });
    expect(heads.map(headName)).toEqual([
      "Sunday, October 11",
      "Monday, October 12",
      "Tuesday, October 13",
      "Wednesday, October 14",
      "Thursday, October 15, today",
      "Friday, October 16",
      "Saturday, October 17",
    ]);
    expect(heads[4]).toHaveAttribute("aria-current", "date");
    expect(heads.filter((b) => b.hasAttribute("aria-current"))).toHaveLength(1);
    expect(heads[4]!.querySelector("[aria-hidden]")).toHaveTextContent("Thu15");
    const badges = region().querySelectorAll("[data-today]");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("15");
    expect(badges[0]).toHaveClass("bg-accent", "text-fg-on-accent", "rounded-full");
  });

  it("makes the day headers one tab stop, on the active day, arrows between them", async () => {
    const user = userEvent.setup();
    renderGrid();
    const heads = within(region()).getAllByRole("button", { name: /day, October \d+/ });
    expect(heads.filter((b) => b.tabIndex === 0).map(headName)).toEqual(["Thursday, October 15, today"]);
    heads[4]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(heads[5]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(heads[0]);
  });

  it("opens a day from its header: the shell switches to that day's view", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const onDateChange = vi.fn();
    renderGrid({ onViewChange, onDateChange });
    await user.click(within(region()).getByRole("button", { name: "Monday, October 12" }));
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenLastCalledWith("day");
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Monday, October 12, 2026" })).toBeInTheDocument();
    expect(region().querySelectorAll(".r-dates-timegrid-body [data-day]")).toHaveLength(1);
    // One day: its header is text, not a button.
    expect(within(region()).queryByRole("button", { name: /October 12/ })).toBeNull();
    expect(within(region()).getByText("Monday, October 12")).toHaveClass("sr-only");
  });

  it("draws the all-day row: its label, bars across the days they cover, squared where they go on past the week", () => {
    renderGrid({ onEventClick: () => {} });
    const row = region().querySelector<HTMLElement>("[data-allday]")!;
    expect(row).toHaveTextContent(/^All day/);
    const oncall = row.querySelector<HTMLElement>('[data-event="oncall"]')!;
    expect(oncall).toHaveAccessibleName(/^On call: Ada, Oct 12\s–\s18, On call$/);
    // Monday (column 3 of the grid: the gutter, then Sunday) through Saturday, and on into Sunday the 18th.
    expect(oncall.style.gridColumn).toBe("3 / span 6");
    expect(oncall).toHaveAttribute("data-continues-after");
    expect(oncall).not.toHaveAttribute("data-continues-before");
    // A one-day all-day event says its day.
    expect(row.querySelector('[data-event="holiday"]')).toHaveAccessibleName("Office closed, Sunday, October 11, All day");
    // All-day events are never timed blocks.
    expect(region().querySelector('.r-dates-timegrid-body [data-event="oncall"]')).toBeNull();
  });

  it("folds a crowded day into '+n more', a toggle that unfolds every lane and folds back", async () => {
    const user = userEvent.setup();
    renderGrid({ events: [...EVENTS, ...CROWD], onEventClick: () => {} });
    const row = region().querySelector<HTMLElement>("[data-allday]")!;
    const shown = () => [...row.querySelectorAll("[data-event]")].map((el) => el.getAttribute("data-event"));
    // Wednesday holds five: on call and one more drawn, the last lane says the other three.
    expect(shown()).toEqual(["holiday", "oncall", "wed-a"]);
    const more = within(row).getByRole("button", { name: "+3 more" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).toHaveAccessibleDescription("Wednesday, October 14");
    expect(within(row).getAllByRole("button", { name: /more$/ })).toHaveLength(1);

    await user.click(more);
    expect(shown()).toEqual(["holiday", "oncall", "wed-a", "wed-b", "wed-c", "wed-d"]);
    const fewer = within(row).getByRole("button", { name: "Show fewer" });
    expect(fewer).toHaveAttribute("aria-expanded", "true");
    expect(within(row).queryByRole("button", { name: /more$/ })).toBeNull();
    // Focus lands on the first event the fold hid, not on <body>.
    expect(document.activeElement).toBe(row.querySelector('[data-event="wed-b"]'));

    await user.click(fewer);
    expect(shown()).toEqual(["holiday", "oncall", "wed-a"]);
    expect(document.activeElement).toBe(within(row).getByRole("button", { name: "+3 more" }));
  });

  it("names every block in full, with its day, and draws an event over midnight on both its days", () => {
    renderGrid({ onEventClick: () => {} });
    const day = new Date(2026, 9, 15);
    const placed = placeEvents(EVENTS);
    const review = placed.find((p) => p.event.id === "review")!;
    expect(block("2026-10-15", "review")).toHaveAccessibleName(eventName(review, "en-US", LABELS, day));
    expect(block("2026-10-15", "review")).toHaveAccessibleName(/^Incident review, Thursday, October 15, 10:00\s–\s11:00\sAM, Room 4\.12$/);

    const friday = block("2026-10-16", "migration");
    const saturday = block("2026-10-17", "migration");
    for (const el of [friday, saturday]) {
      expect(el).toHaveAccessibleName(/^Database migration, Oct 16, 11:00\sPM\s–\sOct 17, 2:30\sAM, Needs sign-off$/);
    }
    expect(friday).toHaveAttribute("data-continues-after");
    expect(friday).not.toHaveAttribute("data-continues-before");
    expect(saturday).toHaveAttribute("data-continues-before");
    expect(saturday).not.toHaveAttribute("data-continues-after");
    // Nowhere else.
    expect(region().querySelectorAll('.r-dates-timegrid-body [data-event="migration"]')).toHaveLength(2);
  });

  it("places blocks by their minutes and their overlap through unitless custom properties", () => {
    renderGrid({ onEventClick: () => {} });
    const review = block("2026-10-15", "review");
    const sync = block("2026-10-15", "sync");
    const oneOnOne = block("2026-10-15", "one-on-one");
    expect([review, sync, oneOnOne].map((el) => [prop(el, "--r-dates-start"), prop(el, "--r-dates-end")])).toEqual([
      ["600", "660"],
      ["630", "690"],
      ["630", "660"],
    ]);
    expect([review, sync, oneOnOne].map((el) => prop(el, "--r-dates-column"))).toEqual(["0", "1", "2"]);
    expect([review, sync, oneOnOne].map((el) => prop(el, "--r-dates-columns"))).toEqual(["3", "3", "3"]);
    expect([review, sync, oneOnOne].map((el) => prop(el, "--r-dates-span"))).toEqual(["1", "1", "1"]);
    // A 15-minute stand-up is drawn 30 minutes tall, alone in its own cluster.
    const standup = block("2026-10-15", "standup-15");
    expect([prop(standup, "--r-dates-start"), prop(standup, "--r-dates-end"), prop(standup, "--r-dates-columns")]).toEqual(["570", "600", "1"]);
    // Over midnight: clipped to each day.
    expect([prop(block("2026-10-16", "migration"), "--r-dates-start"), prop(block("2026-10-16", "migration"), "--r-dates-end")]).toEqual(["1380", "1440"]);
    expect([prop(block("2026-10-17", "migration"), "--r-dates-start"), prop(block("2026-10-17", "migration"), "--r-dates-end")]).toEqual(["0", "150"]);
    // A day knows its widest overlap (its minimum width keeps those blocks a target wide).
    expect(prop(column("2026-10-15"), "--r-dates-overlap")).toBe("3");
    expect(prop(column("2026-10-13"), "--r-dates-overlap")).toBe("1");
  });

  it("draws the now line in today's column only, at the clock's minute", () => {
    renderGrid();
    const lines = region().querySelectorAll<HTMLElement>("[data-now]");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.closest("[data-day]")).toHaveAttribute("data-day", "2026-10-15");
    expect(prop(lines[0]!, "--r-dates-now")).toBe("640");
    expect(lines[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("draws no now line in a week that is not this one", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("region", { name: /^Oct 18\s–\s24, 2026$/ })).toBeInTheDocument();
    expect(region().querySelectorAll("[data-now]")).toHaveLength(0);
  });

  it("has an hour line and a hidden gutter label for every hour", () => {
    renderGrid();
    expect(region().querySelectorAll("[data-hour]")).toHaveLength(24);
    const labels = [...region().querySelectorAll<HTMLElement>("[data-timegrid-hour]")];
    expect(labels).toHaveLength(24);
    expect(labels.every((el) => el.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(labels[8]).toHaveTextContent(/^8:00\sAM$/);
  });

  it("makes the timed blocks one tab stop, starting at the active day's first event", () => {
    renderGrid({ onEventClick: () => {} });
    const stops = blocks().filter((el) => el.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.dataset.block).toBe("2026-10-15|standup-15");
    expect(blocks().filter((el) => el.tabIndex === -1)).toHaveLength(blocks().length - 1);
    expect(blocks().length).toBe(9);
  });

  it("starts the tab stop on a later day when the active day has none", () => {
    renderGrid({ onEventClick: () => {}, defaultDate: new Date(2026, 9, 14) });
    expect(blocks().filter((el) => el.tabIndex === 0).map((el) => el.dataset.block)).toEqual(["2026-10-15|standup-15"]);
  });

  it("walks a day with ArrowDown / ArrowUp by start, then column, staying put at its ends", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    renderGrid({ onEventClick: () => {}, onDateChange });
    block("2026-10-15", "standup-15").focus();
    const walk: (string | undefined)[] = [];
    for (let i = 0; i < 5; i += 1) {
      await user.keyboard("{ArrowDown}");
      walk.push(focusedEvent());
    }
    expect(walk).toEqual([
      "2026-10-15|review",
      "2026-10-15|sync",
      "2026-10-15|one-on-one",
      "2026-10-15|capacity",
      "2026-10-15|capacity",
    ]);
    await user.keyboard("{ArrowUp}");
    expect(focusedEvent()).toBe("2026-10-15|one-on-one");
    // The tab stop follows focus.
    expect(blocks().filter((el) => el.tabIndex === 0).map((el) => el.dataset.block)).toEqual(["2026-10-15|one-on-one"]);
    // Within one day the active day stays.
    expect(onDateChange).toHaveBeenCalledTimes(0);
  });

  it("crosses days with ArrowRight / ArrowLeft to the nearest start, passing empty days, and makes that day active once per move", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    renderGrid({ onEventClick: () => {}, onDateChange });
    block("2026-10-15", "review").focus();

    await user.keyboard("{ArrowRight}");
    expect(focusedEvent()).toBe("2026-10-16|migration");
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2026, 9, 16));

    await user.keyboard("{ArrowRight}");
    expect(focusedEvent()).toBe("2026-10-17|migration");
    expect(onDateChange).toHaveBeenCalledTimes(2);

    // The view's last day: nowhere to go, nothing changes.
    await user.keyboard("{ArrowRight}");
    expect(focusedEvent()).toBe("2026-10-17|migration");
    expect(onDateChange).toHaveBeenCalledTimes(2);

    // Back over Friday to Thursday's start nearest 23:00, then over empty Wednesday to Tuesday.
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(focusedEvent()).toBe("2026-10-15|capacity");
    expect(onDateChange).toHaveBeenCalledTimes(4);
    await user.keyboard("{ArrowLeft}");
    expect(focusedEvent()).toBe("2026-10-13|plan");
    expect(onDateChange).toHaveBeenCalledTimes(5);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2026, 9, 13));
    // The shell followed: the stop is where focus is, the active day the one it is on.
    expect(screen.getByRole("button", { name: "Tuesday, October 13" })).toHaveAttribute("tabindex", "0");
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
          defaultDate={new Date(2026, 9, 15)}
          onEventClick={() => {}}
          onDateChange={onDateChange}
        />
      </div>,
    );
    block("2026-10-15", "review").focus();
    await user.keyboard("{ArrowLeft}");
    expect(focusedEvent()).toBe("2026-10-16|migration");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(focusedEvent()).toBe("2026-10-13|plan");
    expect(onDateChange).toHaveBeenCalledTimes(3);
  });

  it("goes to the view's first and last block with Home and End", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    renderGrid({ onEventClick: () => {}, onDateChange });
    block("2026-10-15", "sync").focus();
    await user.keyboard("{Home}");
    expect(focusedEvent()).toBe("2026-10-12|standup-12");
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2026, 9, 12));
    await user.keyboard("{End}");
    expect(focusedEvent()).toBe("2026-10-17|migration");
    expect(onDateChange).toHaveBeenCalledTimes(2);
    // Already there.
    await user.keyboard("{End}");
    expect(onDateChange).toHaveBeenCalledTimes(2);
  });

  it("presses a block once per press, by pointer and by Enter", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    renderGrid({ onEventClick });
    await user.click(block("2026-10-15", "review"));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenLastCalledWith(EVENTS.find((e) => e.id === "review"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onEventClick).toHaveBeenCalledTimes(2);
    expect(onEventClick).toHaveBeenLastCalledWith(EVENTS.find((e) => e.id === "sync"));
  });

  it("makes an event with an href a link, and links share the one tab stop without onEventClick", () => {
    const events = EVENTS.map((e) => (e.id === "review" ? { ...e, href: "/incidents/42" } : e));
    renderGrid({ events });
    const link = within(column("2026-10-15")).getByRole("link", { name: /^Capacity planning, Thursday, October 15/ });
    expect(link).toHaveAttribute("href", "/ops/capacity");
    const review = within(column("2026-10-15")).getByRole("link", { name: /^Incident review, Thursday, October 15/ });
    // Two links, one stop (the first of the active day); the rest are text.
    expect(review).toHaveAttribute("tabindex", "0");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(blocks().filter((el) => el.matches("a[href], button"))).toEqual([review, link]);
    expect(blocks().filter((el) => el.tabIndex >= 0)).toEqual([review]);
  });

  it("leaves nothing but the region focusable when events are text and no day opens", () => {
    const events = EVENTS.filter((e) => !e.href);
    renderGrid({ events, views: ["week"] });
    const r = region();
    const focusable = [...r.querySelectorAll<HTMLElement>("a[href], button, [tabindex]")].filter((el) => el.tabIndex >= 0);
    expect(focusable).toEqual([]);
    expect(r.tabIndex).toBe(0);
    // Positive control: the events are drawn, as text that names them in full.
    expect(blocks()).toHaveLength(8);
    expect(within(column("2026-10-15")).getByText(/^Incident review, Thursday, October 15/)).toHaveClass("sr-only");
    expect(block("2026-10-15", "review")).not.toHaveAttribute("tabindex");
  });

  it("shows one day in the day view, with the now line on today", () => {
    renderGrid({ defaultView: "day", onEventClick: () => {} });
    expect(screen.getByRole("region", { name: "Thursday, October 15, 2026" })).toBeInTheDocument();
    expect([...region().querySelectorAll(".r-dates-timegrid-body [data-day]")].map((d) => d.getAttribute("data-day"))).toEqual(["2026-10-15"]);
    expect(region().querySelectorAll("[data-now]")).toHaveLength(1);
    expect(blocks().map((el) => el.dataset.block)).toEqual([
      "2026-10-15|standup-15",
      "2026-10-15|review",
      "2026-10-15|sync",
      "2026-10-15|one-on-one",
      "2026-10-15|capacity",
    ]);
  });
});
