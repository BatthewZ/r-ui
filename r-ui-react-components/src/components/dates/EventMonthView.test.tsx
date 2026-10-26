// West of Greenwich, before any local Date is built: a `toISOString()` or UTC
// getter would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubPopover } from "../overlays/overlay-stubs.test.helpers";
import { toISODate } from "./date-core";
import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import type { CalendarEvent } from "./event-core";

/** Thursday 15 October 2026, 10:40 local. */
const NOW = new Date(2026, 9, 15, 10, 40);
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute);

const EVENTS: CalendarEvent[] = [
  { id: "maintenance", title: "Maintenance window", start: "2026-10-06", end: "2026-10-08", slot: 3, category: "Infrastructure" },
  { id: "oncall", title: "On call: Grace", start: "2026-10-19", end: "2026-10-25", slot: 4, category: "On call" },
  { id: "deploy", title: "Deploy 4.2", start: at(10, 13, 14), end: at(10, 13, 14, 30), slot: 2, category: "Releases" },
  { id: "runbook", title: "Runbook review", start: at(10, 14, 9), end: at(10, 14, 10), href: "/runbooks/42" },
  // A crowded Wednesday: the on-call bar and five timed events.
  { id: "standup", title: "Stand-up", start: at(10, 21, 9, 30), end: at(10, 21, 9, 45), slot: 1 },
  { id: "vendor", title: "Vendor call", start: at(10, 21, 11), end: at(10, 21, 11, 30) },
  { id: "lunch", title: "Lunch & learn", start: at(10, 21, 12), end: at(10, 21, 13), slot: 6 },
  { id: "interview", title: "Interview", start: at(10, 21, 15), end: at(10, 21, 16), tone: "warning", statusLabel: "Needs feedback" },
  { id: "retro", title: "Sprint retro", start: at(10, 21, 16), end: at(10, 21, 17), slot: 1 },
];

function renderMonth(props: Partial<EventCalendarProps> = {}) {
  const onDateChange = vi.fn<(date: Date) => void>();
  const onViewChange = vi.fn();
  const onEventClick = vi.fn<(event: CalendarEvent) => void>();
  const view = render(
    <EventCalendar
      aria-label="Ops"
      locale="en-US"
      events={EVENTS}
      now={NOW}
      onDateChange={onDateChange}
      onViewChange={onViewChange}
      onEventClick={onEventClick}
      {...props}
    />,
  );
  return { ...view, onDateChange, onViewChange, onEventClick };
}

const cell = (iso: string) => {
  const found = document.querySelector<HTMLElement>(`[role="gridcell"][data-day="${iso}"]`);
  if (!found) throw new Error(`no cell for ${iso}`);
  return found;
};
const focusedDay = () => (document.activeElement as HTMLElement | null)?.dataset.day ?? document.activeElement?.tagName;
/** `Intl` spaces its ranges and day periods with thin and narrow no-break spaces. */
const plain = (text: string | null | undefined) => (text ?? "").replace(/\s/g, " ");
const named = (name: string) => (accessible: string) => plain(accessible) === name;
const isos = (fn: { mock: { calls: [Date][] } }) => fn.mock.calls.map(([d]) => toISODate(d));

describe("EventMonthView", () => {
  it("is a grid named by the month, with full weekday names and a cell per day of every week shown", () => {
    renderMonth();
    const grid = screen.getByRole("grid", { name: "October 2026" });
    expect(within(grid).getAllByRole("columnheader").map((h) => h.getAttribute("aria-label"))).toEqual([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
    // 27 September to 31 October: five weeks, the header row above them.
    expect(within(grid).getAllByRole("row")).toHaveLength(6);
    const cells = within(grid).getAllByRole("gridcell");
    expect(cells).toHaveLength(35);
    expect(cells[0]).toHaveAttribute("data-day", "2026-09-27");
    expect(cells[0]).toHaveAttribute("data-outside");
    expect(cells[34]).toHaveAttribute("data-day", "2026-10-31");
  });

  it("names each day with its event count; today says so and is the one tab stop", () => {
    renderMonth();
    const today = screen.getByRole("gridcell", { name: "Thursday, October 15, today, No events" });
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveAttribute("tabindex", "0");
    expect(document.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
    expect(screen.getByRole("gridcell", { name: "Wednesday, October 21, 6 events" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("gridcell", { name: "Wednesday, October 7, 1 event" })).toBeInTheDocument();
  });

  it("lays multi-day events across their days, continuing over a week's edge", () => {
    renderMonth();
    const bar = document.querySelector<HTMLElement>('.r-dates-month-chip[data-event="maintenance"]');
    // Tuesday to Thursday of the week from Sunday 4 October.
    expect(bar?.style.getPropertyValue("--r-dates-col")).toBe("2");
    expect(bar?.style.getPropertyValue("--r-dates-span")).toBe("3");
    expect(cell("2026-10-06")).toContainElement(bar ?? null);

    const [first, second] = [...document.querySelectorAll<HTMLElement>('.r-dates-month-chip[data-event="oncall"]')];
    expect(first?.style.getPropertyValue("--r-dates-span")).toBe("6");
    expect(first).toHaveAttribute("data-continues-after");
    expect(first).not.toHaveAttribute("data-continues-before");
    expect(second?.style.getPropertyValue("--r-dates-span")).toBe("1");
    expect(second).toHaveAttribute("data-continues-before");
    expect(cell("2026-10-25")).toContainElement(second ?? null);
  });

  it("gives a crowded day '+n more' in its last lane, and dots with a count for the narrow look", async () => {
    const user = userEvent.setup();
    renderMonth();
    const wednesday = cell("2026-10-21");
    // Three lanes: the on-call bar, the stand-up, then "+4 more".
    const more = within(wednesday).getByRole("button", { name: "+4 more" });
    expect(more).toHaveAttribute("tabindex", "-1");
    expect(more.style.getPropertyValue("--r-dates-lane")).toBe("2");
    expect([...wednesday.querySelectorAll(".r-dates-month-chip[data-event]")].map((c) => c.getAttribute("data-event"))).toEqual([
      "standup",
    ]);
    expect(wednesday.querySelectorAll(".r-dates-month-dots .r-dates-event-dot")).toHaveLength(3);
    expect(wednesday.querySelector(".r-dates-month-dots")).toHaveTextContent("+3");

    await user.click(more);
    expect(screen.getByRole("dialog", { name: "Wednesday, October 21" })).toBeInTheDocument();
  });

  it("arrows, Home, End and PageDown move the day, paging the month with focus on the new day", async () => {
    const user = userEvent.setup();
    const { onDateChange } = renderMonth();
    cell("2026-10-15").focus();
    await user.keyboard("{ArrowRight}");
    expect(focusedDay()).toBe("2026-10-16");
    await user.keyboard("{ArrowDown}");
    expect(focusedDay()).toBe("2026-10-23");
    await user.keyboard("{Home}");
    expect(focusedDay()).toBe("2026-10-18");
    await user.keyboard("{End}");
    expect(focusedDay()).toBe("2026-10-24");
    await user.keyboard("{ArrowUp}");
    expect(focusedDay()).toBe("2026-10-17");
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(focusedDay()).toBe("2026-11-17");
    expect(document.activeElement).toHaveAttribute("tabindex", "0");
    expect(isos(onDateChange)).toEqual(["2026-10-16", "2026-10-23", "2026-10-18", "2026-10-24", "2026-10-17", "2026-11-17"]);

    await user.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(screen.getByRole("grid", { name: "November 2025" })).toBeInTheDocument();
    expect(focusedDay()).toBe("2025-11-17");
    expect(onDateChange).toHaveBeenCalledTimes(7);
  });

  it("an arrow past the month's last day pages to the next month and keeps focus on that day", async () => {
    const user = userEvent.setup();
    const { onDateChange } = renderMonth({ defaultDate: new Date(2026, 9, 31) });
    cell("2026-10-31").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(focusedDay()).toBe("2026-11-01");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(focusedDay()).toBe("2026-10-31");
    expect(isos(onDateChange)).toEqual(["2026-11-01", "2026-10-31"]);
  });

  it("left and right follow the reading direction", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ direction: "rtl" }}>
        <EventCalendar aria-label="Ops" locale="en-US" events={EVENTS} now={NOW} />
      </div>,
    );
    cell("2026-10-15").focus();
    await user.keyboard("{ArrowLeft}");
    expect(focusedDay()).toBe("2026-10-16");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(focusedDay()).toBe("2026-10-14");
  });

  it("Enter opens the day's panel listing every event by its full name; Escape closes it and focus returns", async () => {
    const user = userEvent.setup();
    const { onDateChange } = renderMonth({ defaultDate: new Date(2026, 9, 21) });
    const wednesday = cell("2026-10-21");
    wednesday.focus();
    expect(wednesday).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");

    const panel = screen.getByRole("dialog", { name: "Wednesday, October 21" });
    expect(wednesday).toHaveAttribute("aria-expanded", "true");
    expect(wednesday).toHaveAttribute("aria-controls", panel.id);
    const items = within(panel).getAllByRole("listitem");
    expect(items.map((li) => plain(within(li).getByRole("button").getAttribute("aria-label")))).toEqual([
      "On call: Grace, Oct 19 – 25, On call",
      "Stand-up, 9:30 – 9:45 AM",
      "Vendor call, 11:00 – 11:30 AM",
      "Lunch & learn, 12:00 – 1:00 PM",
      "Interview, 3:00 – 4:00 PM, Needs feedback",
      "Sprint retro, 4:00 – 5:00 PM",
    ]);
    await waitFor(() => expect(within(panel).getAllByRole("button")[0]).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(wednesday).toHaveFocus());
    // Already the active day: opening it changed nothing.
    expect(onDateChange).toHaveBeenCalledTimes(0);
  });

  it("a press on a day makes it active and opens its panel; Open day goes to the day view", async () => {
    const user = userEvent.setup();
    const { onDateChange, onViewChange } = renderMonth();
    await user.click(cell("2026-10-13"));
    expect(isos(onDateChange)).toEqual(["2026-10-13"]);
    const panel = screen.getByRole("dialog", { name: "Tuesday, October 13" });
    expect(cell("2026-10-13")).toHaveAttribute("tabindex", "0");

    await user.click(within(panel).getByRole("button", { name: "Open day" }));
    expect(onViewChange.mock.calls).toEqual([["day"]]);
    expect(screen.getByRole("radio", { name: "Day" })).toBeChecked();
    expect(screen.queryByRole("grid", { name: "October 2026" })).not.toBeInTheDocument();
    expect(onDateChange).toHaveBeenCalledTimes(1);
    // The panel that held focus is gone: the day view's first tab stop takes it.
    expect(screen.getByRole("region", { name: "Tuesday, October 13, 2026" })).toHaveFocus();
  });

  it("an empty day's panel says so, and has no Open day where the calendar has no day view", async () => {
    const user = userEvent.setup();
    renderMonth({ views: ["month", "agenda"] });
    await user.click(cell("2026-10-15"));
    const panel = screen.getByRole("dialog", { name: "Thursday, October 15" });
    expect(panel).toHaveTextContent("No events");
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
    await waitFor(() => expect(panel).toHaveFocus());
  });

  it("the panel is promoted to the top layer", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      renderMonth();
      await user.click(cell("2026-10-13"));
      const panel = screen.getByRole("dialog", { hidden: true });
      // Promoted, jsdom draws it `display: none`, which leaves its name empty here.
      expect(document.getElementById(panel.getAttribute("aria-labelledby") ?? "")).toHaveTextContent("Tuesday, October 13");
      expect(panel).toHaveAttribute("popover", "manual");
      expect(popover.show.mock.contexts).toEqual([panel]);
    } finally {
      popover.restore();
    }
  });

  it("a press on an event chip calls onEventClick once and opens no panel", async () => {
    const user = userEvent.setup();
    const { onEventClick, onDateChange } = renderMonth();
    const chip = screen.getByRole("button", { name: named("Deploy 4.2, Tuesday, October 13, 2:00 – 2:30 PM, Releases") });
    expect(chip).toHaveAttribute("tabindex", "-1");
    await user.click(chip);
    expect(onEventClick.mock.calls.map(([e]) => e.id)).toEqual(["deploy"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDateChange).toHaveBeenCalledTimes(0);
    // The same press beside the chip, on its day, does open the panel.
    await user.click(cell("2026-10-13"));
    expect(screen.getByRole("dialog", { name: "Tuesday, October 13" })).toBeInTheDocument();
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("an event with an href is a link; without a handler an event is text and never focusable", () => {
    renderMonth({ onEventClick: undefined });
    const link = screen.getByRole("link", { name: named("Runbook review, Wednesday, October 14, 9:00 – 10:00 AM") });
    expect(link).toHaveAttribute("href", "/runbooks/42");
    expect(link).toHaveAttribute("tabindex", "-1");

    expect(screen.queryByRole("button", { name: /^Deploy 4\.2/ })).not.toBeInTheDocument();
    const text = document.querySelector('.r-dates-month-chip[data-event="deploy"]');
    expect(text?.tagName).toBe("DIV");
    expect(text).not.toHaveAttribute("tabindex");
    expect(text).toHaveTextContent("Deploy 4.2, Tuesday, October 13, 2:00 – 2:30 PM, Releases");
  });

  it("an empty month is every day with no events", () => {
    renderMonth({ events: [], defaultDate: new Date(2026, 11, 1) });
    const cells = within(screen.getByRole("grid", { name: "December 2026" })).getAllByRole("gridcell");
    expect(cells).toHaveLength(35);
    expect(cells.every((c) => c.getAttribute("aria-label")?.endsWith(", No events"))).toBe(true);
    expect(document.querySelectorAll(".r-dates-month-chip")).toHaveLength(0);
    expect(document.querySelectorAll(".r-dates-event-dot")).toHaveLength(0);
  });
});
