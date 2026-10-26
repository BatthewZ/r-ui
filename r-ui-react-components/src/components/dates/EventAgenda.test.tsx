// West of Greenwich before any local Date is built: a `toISOString()` or UTC
// getter anywhere would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { RouterProvider } from "../../util/router";
import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import { type CalendarEvent, placeEvents } from "./event-core";
import { DEFAULT_EVENT_CALENDAR_LABELS, eventName } from "./event-parts";

/** Thursday 15 October 2026, 10:40 local. */
const NOW = new Date(2026, 9, 15, 10, 40);
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute);

const EVENTS: CalendarEvent[] = [
  // Starts in September: listed on its October days only.
  { id: "handover", title: "Quarter handover", start: "2026-09-29", end: "2026-10-02", category: "Company" },
  { id: "deploy", title: "Deploy api 4.3", start: at(10, 6, 14), end: at(10, 6, 14, 30), slot: 2, category: "Releases", tone: "error", statusLabel: "Rolled back" },
  { id: "standup", title: "Stand-up", start: at(10, 6, 9, 30), end: at(10, 6, 9, 45), slot: 1, category: "Platform team" },
  { id: "early", title: "Early check", start: at(10, 6, 8) },
  {
    id: "maintenance",
    title: "Maintenance window",
    start: "2026-10-06",
    end: "2026-10-07",
    slot: 3,
    category: "Infrastructure",
    tone: "info",
    location: "Frankfurt DC2",
    description: "Rolling hardware replacement; expect brief failovers.",
  },
  { id: "review", title: "Incident review", start: at(10, 15, 10), end: at(10, 15, 11), location: "Room 4.12" },
  { id: "migration", title: "Database migration", start: at(10, 15, 23), end: at(10, 16, 2, 30), category: "Infrastructure" },
  // All-day on a day the migration began before: listed above it.
  { id: "hackday", title: "Hack day", start: "2026-10-16" },
  // Runs into November: listed on its October days only.
  { id: "freeze", title: "Release freeze", start: "2026-10-30", end: "2026-11-02", tone: "warning", statusLabel: "Freeze" },
  { id: "later", title: "November deploy", start: at(11, 10, 14), end: at(11, 10, 14, 30) },
];

const PLACED = placeEvents(EVENTS);
const placed = (id: string) => PLACED.find((p) => p.event.id === id)!;
const LABELS = DEFAULT_EVENT_CALENDAR_LABELS;

function renderAgenda(props: Partial<EventCalendarProps> = {}) {
  return render(
    <EventCalendar
      events={EVENTS}
      now={NOW}
      locale="en-US"
      defaultView="agenda"
      defaultDate={new Date(2026, 9, 15)}
      {...props}
    />,
  );
}

const agenda = () => screen.getByRole("list", { name: "October 2026" });
/** Each day list's name, in order. */
const dayNames = () =>
  [...agenda().querySelectorAll("ul[aria-labelledby]")].map((ul) => document.getElementById(ul.getAttribute("aria-labelledby")!)?.textContent);
const titlesOn = (day: string) =>
  within(screen.getByRole("list", { name: day }))
    .getAllByRole("listitem")
    .map((li) => li.querySelector("[data-event]")?.getAttribute("data-event"));

describe("EventCalendar agenda", () => {
  it("lists every day of the month that has events, in order, a multi-day event on each of its days inside the month", () => {
    renderAgenda();
    expect(dayNames()).toEqual([
      "Thursday, October 1",
      "Friday, October 2",
      "Tuesday, October 6",
      "Wednesday, October 7",
      "Thursday, October 15, today",
      "Friday, October 16",
      "Friday, October 30",
      "Saturday, October 31",
    ]);
    // The handover from September, the migration over midnight, the freeze into November.
    expect(titlesOn("Thursday, October 1")).toEqual(["handover"]);
    expect(titlesOn("Friday, October 2")).toEqual(["handover"]);
    expect(titlesOn("Wednesday, October 7")).toEqual(["maintenance"]);
    expect(titlesOn("Friday, October 16")).toEqual(["hackday", "migration"]);
    expect(titlesOn("Saturday, October 31")).toEqual(["freeze"]);
    expect(screen.queryByText("November deploy")).toBeNull();
  });

  it("follows the period: next month lists November's days, the freeze's last two among them", async () => {
    const user = userEvent.setup();
    renderAgenda();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    const november = screen.getByRole("list", { name: "November 2026" });
    const names = [...november.querySelectorAll("ul[aria-labelledby]")].map(
      (ul) => document.getElementById(ul.getAttribute("aria-labelledby")!)?.textContent,
    );
    expect(names).toEqual(["Sunday, November 1", "Monday, November 2", "Tuesday, November 10"]);
  });

  it("orders a day all-day first, then by start", () => {
    renderAgenda();
    expect(titlesOn("Tuesday, October 6")).toEqual(["maintenance", "early", "standup", "deploy"]);
    expect(titlesOn("Thursday, October 15, today")).toEqual(["review", "migration"]);
    // The migration began the day before, yet the all-day event comes first.
    expect(titlesOn("Friday, October 16")).toEqual(["hackday", "migration"]);
  });

  it("names every event in full, with its day, and shows its full time on each of its days", () => {
    renderAgenda({ onEventClick: () => {} });
    const oct6 = screen.getByRole("list", { name: "Tuesday, October 6" });
    const names = within(oct6).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    const day = new Date(2026, 9, 6);
    expect(names).toEqual(["maintenance", "early", "standup", "deploy"].map((id) => eventName(placed(id), "en-US", LABELS, day)));
    // Said in words, not only through the helper.
    expect(names[3]).toMatch(/^Deploy api 4\.3, Tuesday, October 6, 2:00\s–\s2:30\sPM, Releases, Rolled back$/);
    expect(names[0]).toMatch(/^Maintenance window, Oct 6\s–\s7, Infrastructure, Info, Frankfurt DC2$/);

    // The migration over midnight shows its whole range on both days.
    for (const dayName of ["Thursday, October 15, today", "Friday, October 16"]) {
      const row = within(screen.getByRole("list", { name: dayName })).getByRole("button", { name: /^Database migration/ });
      expect(row).toHaveTextContent(/Oct 15, 11:00\sPM\s–\sOct 16, 2:30\sAM/);
    }
  });

  it("shows the status glyph and word, category and location, and the description", () => {
    renderAgenda();
    const oct6 = screen.getByRole("list", { name: "Tuesday, October 6" });
    const status = within(oct6).getByText("Rolled back").closest("[data-agenda-status]");
    expect(status).not.toBeNull();
    expect(status?.querySelector("svg")).not.toBeNull();
    expect(status).toHaveClass("text-fg-error");
    // The tone's own word where the event sets none.
    expect(within(oct6).getByText("Info").closest("[data-agenda-status]")).not.toBeNull();
    expect(within(oct6).getByText("Infrastructure · Frankfurt DC2")).toBeInTheDocument();
    expect(within(oct6).getByText("Rolling hardware replacement; expect brief failovers.")).toBeInTheDocument();
    // An event with no tone shows no status.
    const standup = oct6.querySelector('[data-event="standup"]')!;
    expect(standup.querySelector("[data-agenda-status]")).toBeNull();
    expect(standup).toHaveTextContent("Platform team");
  });

  it("renders an href as the router's link, which also calls onEventClick", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    function AppLink({ href, ...props }: ComponentPropsWithRef<"a"> & { href: string }) {
      return <a data-app-link="" href={href} {...props} onClick={(e) => { e.preventDefault(); props.onClick?.(e); }} />;
    }
    const linked = EVENTS.map((e) => ({ ...e, href: `/events/${e.id}` }));
    render(
      <RouterProvider link={AppLink}>
        <EventCalendar events={linked} now={NOW} locale="en-US" defaultView="agenda" onEventClick={onEventClick} />
      </RouterProvider>,
    );
    const link = within(agenda()).getByRole("link", { name: /^Incident review, Thursday, October 15/ });
    expect(link).toHaveAttribute("href", "/events/review");
    expect(link).toHaveAttribute("data-app-link");
    expect(within(agenda()).queryAllByRole("button")).toHaveLength(0);
    await user.click(link);
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(linked.find((e) => e.id === "review"));
  });

  it("makes each event a button with onEventClick, one tab stop each in order, called once per press", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    renderAgenda({ onEventClick });
    const buttons = within(agenda()).getAllByRole("button");
    // 2 (handover) + 4 (Oct 6) + 1 + 2 + 2 + 2 (freeze).
    expect(buttons).toHaveLength(13);
    buttons[0]!.focus();
    await user.tab();
    expect(buttons[1]).toHaveFocus();
    await user.tab();
    expect(buttons[2]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(EVENTS.find((e) => e.id === "maintenance"));
    expect(buttons[2]).toHaveClass("hover:bg-fg-primary/8");
  });

  it("draws events as text without a handler or href: never focusable, still named", () => {
    renderAgenda();
    const rows = [...agenda().querySelectorAll<HTMLElement>("[data-event]")];
    expect(rows).toHaveLength(13);
    for (const row of rows) {
      expect(row.tagName).toBe("DIV");
      expect(row.tabIndex).toBe(-1);
      expect(row.hasAttribute("tabindex")).toBe(false);
      expect(row).not.toHaveClass("hover:bg-fg-primary/8");
    }
    expect(within(agenda()).queryAllByRole("button")).toHaveLength(0);
    expect(within(agenda()).queryAllByRole("link")).toHaveLength(0);
    const review = agenda().querySelector('[data-event="review"]')!;
    expect(review.querySelector(".sr-only")?.textContent).toBe(eventName(placed("review"), "en-US", LABELS, new Date(2026, 9, 15)));
  });

  it("marks today's header with the accent badge and its spoken name", () => {
    renderAgenda();
    const today = agenda().querySelector("[data-today]");
    expect(today).toHaveTextContent("Thursday, October 15");
    expect(today).toHaveClass("bg-accent", "text-fg-on-accent", "rounded-full");
    expect(agenda().querySelectorAll("[data-today]")).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Thursday, October 15, today" })).toBeInTheDocument();
    // Another day says no "today".
    expect(screen.getByRole("list", { name: "Friday, October 16" })).toBeInTheDocument();
  });

  it("says nothing is scheduled for an empty month, and shows no list", () => {
    renderAgenda({ defaultDate: new Date(2026, 11, 1) });
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "December 2026" })).toBeNull();
    // The label is the calendar's own.
    renderAgenda({ defaultDate: new Date(2026, 11, 1), labels: { emptyPeriod: "Free month" } });
    expect(screen.getByText("Free month")).toBeInTheDocument();
  });

  it("withholds the empty state while loading", () => {
    renderAgenda({ events: [], loading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading events");
    expect(screen.queryByText("Nothing scheduled")).toBeNull();
  });
});
