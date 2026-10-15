import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "../form";
import { toISODate } from "./date-core";
import { DateRangePicker, type DateRangeValue } from "./DateRangePicker";

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d);
const asIso = (v: DateRangeValue) => [toISODate(v.start), toISODate(v.end), v.preset];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
});
afterEach(() => vi.useRealTimers());

describe("DateRangePicker", () => {
  it("shows the range compactly; a Field names it with its label plus the range", () => {
    render(
      <Field>
        <Field.Label>Report period</Field.Label>
        <DateRangePicker locale="en-US" defaultValue={{ start: day(10, 1), end: day(10, 7) }} />
        <Field.Description>Calendar days.</Field.Description>
      </Field>,
    );
    const trigger = screen.getByRole("button", { name: /^Report period Oct 1\s–\s7, 2026$/ });
    expect(trigger).toHaveAccessibleDescription("Calendar days.");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("a preset applies at once, closes, and is what the trigger shows", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DateRangePicker aria-label="Time range" locale="en-US" onValueChange={onValueChange} />);
    const trigger = screen.getByRole("button", { name: "Time range Select dates" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Choose a date range" });
    await user.click(within(dialog).getByRole("button", { name: "Last 7 days" }));
    expect(onValueChange.mock.calls.map(([v]) => asIso(v))).toEqual([["2026-10-09", "2026-10-15", "last-7-days"]]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveAccessibleName("Time range Last 7 days");

    // Last 24 hours is a span of instants, not calendar days.
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Last 24 hours" }));
    const last = onValueChange.mock.calls[1]?.[0] as DateRangeValue;
    expect(last.end.getTime() - last.start.getTime()).toBe(86_400_000);
    expect(last.preset).toBe("last-24-hours");
  });

  it("a custom range by keyboard is a draft until Apply", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DateRangePicker aria-label="Time range" locale="en-US" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /Time range/ }));
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeDisabled();
    // Focus moves in to the first quick range.
    await waitFor(() => expect(screen.getByRole("button", { name: "Last 24 hours" })).toHaveFocus());

    screen.getByRole("button", { name: /October 15, 2026, today/ }).focus();
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{Enter}");
    expect(onValueChange.mock.calls).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Start" })).toHaveValue("10/15/2026");
    expect(screen.getByRole("textbox", { name: "End" })).toHaveValue("10/17/2026");
    await user.click(apply);
    expect(onValueChange.mock.calls.map(([v]) => asIso(v))).toEqual([["2026-10-15", "2026-10-17", undefined]]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("typed start and end move the calendar; an end before the start is refused", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DateRangePicker aria-label="Time range" locale="de-DE" presets={[]} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /Time range/ }));
    const start = screen.getByRole("textbox", { name: "Start" });
    const end = screen.getByRole("textbox", { name: "End" });
    await user.type(start, "03.02.2027{Enter}");
    expect(screen.getAllByRole("grid").map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent)).toEqual([
      "Februar 2027",
      "März 2027",
    ]);
    await user.type(end, "01.02.2027{Enter}");
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAccessibleDescription("The end is before the start.");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    await user.clear(end);
    await user.type(end, "10.02.2027{Enter}");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onValueChange.mock.calls.map(([v]) => asIso(v))).toEqual([["2027-02-03", "2027-02-10", undefined]]);
  });

  it("Cancel discards the draft; reopening starts from the committed range", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DateRangePicker aria-label="Time range" locale="en-US" defaultValue={{ start: day(10, 1), end: day(10, 7) }} onValueChange={onValueChange} />,
    );
    const trigger = screen.getByRole("button", { name: /Time range/ });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /October 20, 2026/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onValueChange).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(screen.getByRole("textbox", { name: "Start" })).toHaveValue("10/01/2026");
    expect(screen.getByRole("textbox", { name: "End" })).toHaveValue("10/07/2026");
  });

  it("disables presets outside min/max and submits an ISO interval", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="form">
        <DateRangePicker aria-label="Time range" name="period" locale="en-US" min={day(10, 1)} defaultValue={{ start: day(10, 2), end: day(10, 9) }} />
      </form>,
    );
    expect(new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement).get("period")).toBe("2026-10-02/2026-10-09");
    await user.click(screen.getByRole("button", { name: /Time range/ }));
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeEnabled();
  });
});
