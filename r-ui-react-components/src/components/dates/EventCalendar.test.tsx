// West of Greenwich before any local Date is built: a `toISOString()` or UTC
// getter anywhere would move a local midnight to the day before.
process.env.TZ = "America/New_York";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider, type LocaleLabels } from "../../util/locale";
import { toISODate } from "./date-core";
import { EventCalendar, type EventCalendarProps } from "./EventCalendar";
import type { CalendarEvent, EventCalendarView } from "./event-core";

/** Thursday 15 October 2026, 10:40 local. */
const NOW = new Date(2026, 9, 15, 10, 40);
const EVENTS: CalendarEvent[] = [{ id: "review", title: "Incident review", start: new Date(2026, 9, 15, 10), end: new Date(2026, 9, 15, 11) }];

function renderCalendar(props: Partial<EventCalendarProps> = {}) {
  return render(<EventCalendar events={EVENTS} now={NOW} locale="en-US" {...props} />);
}

/** The period title: the toolbar's polite live region. */
const title = () => {
  const live = document.querySelectorAll('[aria-live="polite"]');
  expect(live).toHaveLength(1);
  return live[0]!.textContent;
};
const isoCalls = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.map(([d]) => toISODate(d as Date));

describe("EventCalendar shell", () => {
  it("is a named group with Today, previous, next and the view switch", () => {
    renderCalendar({ "aria-label": "Ops calendar" });
    const calendar = screen.getByRole("group", { name: "Ops calendar" });
    expect(within(calendar).getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(within(calendar).getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(within(calendar).getByRole("button", { name: "Next month" })).toBeInTheDocument();
    const views = within(calendar).getByRole("radiogroup", { name: "View" });
    expect(within(views).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(["Month", "Week", "Day", "Agenda"]);
    expect(within(views).getByRole("radio", { name: "Month" })).toBeChecked();
  });

  it("is named 'Calendar' without an aria-label, and by aria-labelledby when given", () => {
    const { unmount } = renderCalendar();
    expect(screen.getByRole("group", { name: "Calendar" })).toBeInTheDocument();
    unmount();
    render(
      <>
        <h2 id="cal-heading">Releases</h2>
        <EventCalendar events={EVENTS} now={NOW} locale="en-US" aria-labelledby="cal-heading" />
      </>,
    );
    expect(screen.getByRole("group", { name: "Releases" })).not.toHaveAttribute("aria-label");
  });

  it.each<[EventCalendarView, string, string[], string]>([
    // A month keeps its day, clamped to a shorter month (and stays clamped after).
    ["month", "2026-01-31", ["2025-12-31", "2026-01-31", "2026-02-28"], "Previous month"],
    ["week", "2026-10-15", ["2026-10-08", "2026-10-15", "2026-10-22"], "Previous week"],
    ["day", "2026-10-31", ["2026-10-30", "2026-10-31", "2026-11-01"], "Previous day"],
    ["agenda", "2026-03-31", ["2026-02-28", "2026-03-28", "2026-04-28"], "Previous month"],
  ])("pages the %s view from %s: back once, forward twice → %j", async (view, from, expected, previousName) => {
    const user = userEvent.setup();
    const [y, m, d] = from.split("-").map(Number) as [number, number, number];
    const onDateChange = vi.fn();
    renderCalendar({ defaultView: view, defaultDate: new Date(y, m - 1, d), onDateChange });
    const nextName = previousName.replace("Previous", "Next");
    await user.click(screen.getByRole("button", { name: previousName }));
    expect(isoCalls(onDateChange)).toEqual(expected.slice(0, 1));
    await user.click(screen.getByRole("button", { name: nextName }));
    await user.click(screen.getByRole("button", { name: nextName }));
    expect(isoCalls(onDateChange)).toEqual(expected);
  });

  it("goes to today's period with Today, from now's day", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    renderCalendar({ defaultDate: new Date(2026, 0, 31), onDateChange });
    expect(title()).toBe("January 2026");
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(isoCalls(onDateChange)).toEqual(["2026-10-15"]);
    expect(title()).toBe("October 2026");
    // Already today: nothing changes, nothing is reported.
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });

  it("titles each view's period in the polite live region", () => {
    const date = new Date(2026, 9, 15);
    const { rerender } = renderCalendar({ view: "month", date });
    expect(title()).toBe("October 2026");
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-US" view="week" date={date} />);
    expect(title()).toMatch(/^Oct 11\s–\s17, 2026$/);
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-US" view="day" date={date} />);
    expect(title()).toBe("Thursday, October 15, 2026");
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-US" view="agenda" date={date} />);
    expect(title()).toBe("October 2026");
  });

  it("switches views with the segmented control, reporting each once", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    renderCalendar({ defaultDate: new Date(2026, 9, 15), onViewChange });
    await user.click(screen.getByRole("radio", { name: "Agenda" }));
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenLastCalledWith("agenda");
    expect(screen.getByRole("radio", { name: "Agenda" })).toBeChecked();
    expect(screen.getByRole("list", { name: "October 2026" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Day" }));
    expect(onViewChange).toHaveBeenCalledTimes(2);
    expect(onViewChange).toHaveBeenLastCalledWith("day");
    expect(title()).toBe("Thursday, October 15, 2026");
    expect(screen.getByRole("button", { name: "Next day" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "October 2026" })).toBeNull();
  });

  it("offers no switch for a single view, and only the listed views in their order", () => {
    const { unmount } = renderCalendar({ views: ["agenda"], defaultView: "agenda" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    unmount();
    renderCalendar({ views: ["agenda", "month"], defaultView: "agenda" });
    const radios = within(screen.getByRole("radiogroup", { name: "View" })).getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual(["Agenda", "Month"]);
  });

  it("keeps a controlled date and view until the parent changes them", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    const onViewChange = vi.fn();
    const props = { events: EVENTS, now: NOW, locale: "en-US", onDateChange, onViewChange };
    const { rerender } = render(<EventCalendar {...props} view="month" date={new Date(2026, 9, 15)} />);
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(isoCalls(onDateChange)).toEqual(["2026-11-15"]);
    expect(title()).toBe("October 2026");
    await user.click(screen.getByRole("radio", { name: "Week" }));
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith("week");
    expect(title()).toBe("October 2026");
    expect(screen.getByRole("radio", { name: "Month" })).toBeChecked();

    rerender(<EventCalendar {...props} view="week" date={new Date(2026, 10, 15)} />);
    expect(title()).toMatch(/^Nov 15\s–\s21, 2026$/);
    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
    // Paging from the parent's date, not the one the calendar started on.
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(isoCalls(onDateChange)).toEqual(["2026-11-15", "2026-11-22"]);
  });

  it("starts on today from `now` when no date is given", () => {
    const { unmount } = renderCalendar({ defaultView: "day" });
    expect(title()).toBe("Thursday, October 15, 2026");
    unmount();
    renderCalendar({ defaultView: "day", now: new Date(2027, 1, 3, 23, 59).getTime() });
    expect(title()).toBe("Wednesday, February 3, 2027");
  });

  it("takes labels from the LocaleProvider, the instance's winning", () => {
    const provided: LocaleLabels = {
      EventCalendar: { today: "Heute", viewSwitch: "Ansicht", next: { month: "Nächster Monat" }, views: { agenda: "Liste" } },
    };
    render(
      <LocaleProvider labels={provided}>
        <EventCalendar events={EVENTS} now={NOW} locale="en-US" labels={{ today: "Jetzt" }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Jetzt" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Heute" })).toBeNull();
    expect(screen.getByRole("button", { name: "Nächster Monat" })).toBeInTheDocument();
    // A map label merges key by key: the defaults fill what the provider left out.
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    const views = screen.getByRole("radiogroup", { name: "Ansicht" });
    expect(within(views).getByRole("radio", { name: "Liste" })).toBeInTheDocument();
    expect(within(views).getByRole("radio", { name: "Month" })).toBeInTheDocument();
  });

  it("is busy and says so while loading, and not otherwise", () => {
    const { rerender } = renderCalendar({ loading: true, defaultView: "agenda" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading events");
    expect(status.parentElement).toHaveAttribute("aria-busy", "true");
    // The agenda inside the busy body still lists what is known.
    expect(status.parentElement).toContainElement(screen.getByRole("list", { name: "October 2026" }));
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-US" defaultView="agenda" />);
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.getByRole("status").parentElement).not.toHaveAttribute("aria-busy");
  });

  it("starts the week on weekStartsOn, else on the locale's first day", () => {
    const date = new Date(2026, 9, 15);
    const { rerender } = renderCalendar({ view: "week", date });
    expect(title()).toMatch(/^Oct 11\s–\s17, 2026$/);
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-US" view="week" date={date} weekStartsOn={1} />);
    expect(title()).toMatch(/^Oct 12\s–\s18, 2026$/);
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-GB" view="week" date={date} />);
    expect(title()).toMatch(/^12\s?–\s?18 Oct 2026$/);
    rerender(<EventCalendar events={EVENTS} now={NOW} locale="en-GB" view="week" date={date} weekStartsOn={6} />);
    expect(title()).toMatch(/^10\s?–\s?16 Oct 2026$/);
  });

  it("re-places events when the events prop changes, and only then", () => {
    const first: CalendarEvent[] = [{ id: "a", title: "First plan", start: "2026-10-05" }];
    const { rerender } = render(<EventCalendar events={first} now={NOW} locale="en-US" defaultView="agenda" />);
    expect(screen.getByText("First plan")).toBeInTheDocument();
    // A new array with a moved and an added event.
    const second: CalendarEvent[] = [
      { id: "a", title: "First plan", start: "2026-10-09" },
      { id: "b", title: "Second plan", start: "2026-10-20" },
    ];
    rerender(<EventCalendar events={second} now={NOW} locale="en-US" defaultView="agenda" />);
    expect(screen.queryByRole("list", { name: "Monday, October 5" })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Friday, October 9" })).getByText("First plan")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Tuesday, October 20" })).getByText("Second plan")).toBeInTheDocument();
    rerender(<EventCalendar events={[]} now={NOW} locale="en-US" defaultView="agenda" />);
    expect(screen.queryByText("First plan")).toBeNull();
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
  });
});
