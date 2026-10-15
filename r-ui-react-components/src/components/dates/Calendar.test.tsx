import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Field } from "../form";
import { Calendar } from "./Calendar";
import { toISODate } from "./date-core";
import { RangeCalendar } from "./RangeCalendar";

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d);
const focusedDate = () => (document.activeElement as HTMLElement | null)?.dataset.date;
const grids = () => screen.getAllByRole("grid").map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent);

beforeEach(() => {
  // Only Date is faked: "today" is 15 October 2026, timers stay real for user-event.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
});
afterEach(() => vi.useRealTimers());

describe("Calendar", () => {
  it("is an APG grid: month caption, full weekday names, one tab stop, today marked", () => {
    render(<Calendar aria-label="Due" locale="en-US" />);
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
    const today = screen.getByRole("button", { name: "Thursday, October 15, 2026, today" });
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveAttribute("tabindex", "0");
    expect(grid.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
  });

  it("says the chosen day is selected on the day itself, where focus lands", () => {
    render(<Calendar aria-label="Due" locale="en-US" defaultValue={day(10, 20)} />);
    const chosen = screen.getByRole("button", { name: "Tuesday, October 20, 2026, selected" });
    expect(chosen).toHaveAttribute("tabindex", "0");
    expect(chosen.closest('[role="gridcell"]')).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Thursday, October 15, 2026, today" })).toBeInTheDocument();
  });

  it("takes one Date | null handler, as its value and the pickers do", async () => {
    const user = userEvent.setup();
    const picked: (Date | null)[] = [];
    const onValueChange: (date: Date | null) => void = (date) => picked.push(date);
    render(<Calendar aria-label="Due" locale="en-US" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /October 21, 2026/ }));
    expect(picked.map((d) => d && toISODate(d))).toEqual(["2026-10-21"]);
    expectTypeOf<Parameters<NonNullable<React.ComponentProps<typeof Calendar>["onValueChange"]>>[0]>().toEqualTypeOf<Date | null>();
  });

  it("starts the week and names the month in the locale", () => {
    render(<Calendar aria-label="Datum" locale="de-DE" />);
    const grid = screen.getByRole("grid", { name: "Oktober 2026" });
    expect(within(grid).getAllByRole("columnheader")[0]).toHaveAttribute("aria-label", "Montag");
  });

  it("arrows cross a month boundary and page the view", async () => {
    const user = userEvent.setup();
    render(<Calendar aria-label="Due" locale="en-US" defaultValue={day(10, 31)} />);
    await user.click(screen.getByRole("button", { name: /October 31, 2026/ }));
    await user.keyboard("{ArrowRight}");
    expect(focusedDate()).toBe("2026-11-01");
    expect(grids()).toEqual(["November 2026"]);
    await user.keyboard("{ArrowUp}");
    expect(focusedDate()).toBe("2026-10-25");
    expect(grids()).toEqual(["October 2026"]);
  });

  it("Home/End go to the week's ends, PageUp/PageDown by month, with Shift by year", async () => {
    const user = userEvent.setup();
    render(<Calendar aria-label="Due" locale="de-DE" defaultValue={day(1, 31)} />);
    await user.click(screen.getByRole("button", { name: /31\. Januar 2026/ }));
    // 31 January 2026 is a Saturday; a de-DE week runs Monday to Sunday.
    await user.keyboard("{Home}");
    expect(focusedDate()).toBe("2026-01-26");
    await user.keyboard("{End}");
    expect(focusedDate()).toBe("2026-02-01");
    await user.keyboard("{PageUp}");
    expect(focusedDate()).toBe("2026-01-01");
    await user.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(focusedDate()).toBe("2027-01-01");
    expect(grids()).toEqual(["Januar 2027"]);
  });

  it("left and right follow the reading direction", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ direction: "rtl" }}>
        <Calendar aria-label="Due" locale="en-US" defaultValue={day(10, 15)} />
      </div>,
    );
    screen.getByRole("button", { name: /October 15, 2026/ }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(focusedDate()).toBe("2026-10-16");
  });

  it("selects by press and by Enter; unavailable and out-of-bounds days are focusable but refused", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        aria-label="Due"
        locale="en-US"
        min={day(10, 5)}
        max={day(10, 28)}
        isDateUnavailable={(d) => d.getDate() === 21}
        onValueChange={onValueChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /October 20, 2026/ }));
    expect(onValueChange.mock.calls.map(([d]) => toISODate(d))).toEqual(["2026-10-20"]);
    expect(screen.getByRole("button", { name: /October 20, 2026/ }).closest("td")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    const unavailable = screen.getByRole("button", { name: /October 21, 2026/ });
    expect(unavailable).toHaveFocus();
    expect(unavailable).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: /October 4, 2026/ }));
    expect(onValueChange).toHaveBeenCalledTimes(1);

    // Navigation stops at the bounds.
    screen.getByRole("button", { name: /October 27, 2026/ }).focus();
    await user.keyboard("{PageDown}");
    expect(focusedDate()).toBe("2026-10-28");
    expect(screen.getByRole("button", { name: "Next month" })).toHaveAttribute("aria-disabled", "true");
  });

  it("the month buttons page the view without taking focus off themselves", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(<Calendar aria-label="Due" locale="en-US" onMonthChange={onMonthChange} />);
    const next = screen.getByRole("button", { name: "Next month" });
    await user.click(next);
    expect(next).toHaveFocus();
    expect(grids()).toEqual(["November 2026"]);
    expect(onMonthChange.mock.calls.map(([m]) => toISODate(m))).toEqual(["2026-11-01"]);
    // The tab stop moved into the new view.
    expect(screen.getByRole("grid").querySelector('[tabindex="0"]')).toHaveAttribute("data-date", "2026-11-15");
  });

  it("follows a value set from outside to its month", () => {
    const { rerender } = render(<Calendar aria-label="Due" locale="en-US" value={day(10, 2)} />);
    rerender(<Calendar aria-label="Due" locale="en-US" value={day(3, 9, 2027)} />);
    expect(grids()).toEqual(["March 2027"]);
    expect(screen.getByRole("button", { name: /March 9, 2027/ }).closest("td")).toHaveAttribute("aria-selected", "true");
  });

  it("is named by its Field's label and disabled by it", () => {
    render(
      <Field disabled>
        <Field.Label>Start day</Field.Label>
        <Calendar locale="en-US" />
      </Field>,
    );
    const calendar = screen.getByRole("group", { name: "Start day" });
    expect(within(calendar).getByRole("button", { name: /October 15/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("renders up to `months` grids, each date once", () => {
    render(<Calendar aria-label="Due" locale="en-US" months={3} />);
    expect(grids()).toEqual(["October 2026", "November 2026", "December 2026"]);
    expect(screen.getAllByRole("button", { name: /November 1, 2026/ })).toHaveLength(1);
  });
});

describe("RangeCalendar", () => {
  it("selects a range by keyboard, previewing it while the end is open", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<RangeCalendar aria-label="Window" locale="en-US" onValueChange={onValueChange} />);
    expect(grids()).toEqual(["October 2026", "November 2026"]);

    screen.getByRole("button", { name: /October 15, 2026/ }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    // 5 November, in the second month: no paging, and the preview spans the gap.
    expect(focusedDate()).toBe("2026-11-05");
    expect(grids()).toEqual(["October 2026", "November 2026"]);
    expect(screen.getByRole("button", { name: /October 30, 2026/ })).toHaveAccessibleName(/in range$/);
    await user.keyboard("{Enter}");

    const calls = onValueChange.mock.calls.map(([r]) => [r.start && toISODate(r.start), r.end && toISODate(r.end)]);
    expect(calls).toEqual([
      ["2026-10-15", null],
      ["2026-10-15", "2026-11-05"],
    ]);
    expect(screen.getByRole("button", { name: /October 15, 2026/ })).toHaveAccessibleName(/start of range$/);
    expect(screen.getByRole("button", { name: /November 5, 2026/ })).toHaveAccessibleName(/end of range$/);
    expect(screen.getByRole("button", { name: /October 20, 2026/ }).closest("td")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /November 6, 2026/ }).closest("td")).not.toHaveAttribute("aria-selected");
  });

  it("orders endpoints picked backwards", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<RangeCalendar aria-label="Window" locale="en-US" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /October 20, 2026/ }));
    await user.click(screen.getByRole("button", { name: /October 12, 2026/ }));
    const [start, end] = [onValueChange.mock.calls[1]?.[0].start, onValueChange.mock.calls[1]?.[0].end];
    expect([toISODate(start), toISODate(end)]).toEqual(["2026-10-12", "2026-10-20"]);
  });

  it("refuses an end that would span an unavailable day", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RangeCalendar aria-label="Window" locale="en-US" isDateUnavailable={(d) => toISODate(d) === "2026-10-18"} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("button", { name: /October 14, 2026/ }));
    const beyond = screen.getByRole("button", { name: /October 22, 2026/ });
    expect(beyond).toHaveAttribute("aria-disabled", "true");
    await user.click(beyond);
    await user.click(screen.getByRole("button", { name: /October 17, 2026/ }));
    expect(onValueChange.mock.calls.map(([r]) => r.end && toISODate(r.end))).toEqual([null, "2026-10-17"]);
  });
});
