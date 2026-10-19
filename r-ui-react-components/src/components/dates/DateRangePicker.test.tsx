import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "../form";
import { type DateRange, toISODate } from "./date-core";
import { DateRangePicker } from "./DateRangePicker";

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d);
const asIso = (v: DateRange<Date>) => [toISODate(v.start), toISODate(v.end), v.preset];

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
    const last = onValueChange.mock.calls[1]?.[0] as DateRange<Date>;
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

  it("`now` is the clock presets resolve against: enabled and committed from it, not the device's", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // The data ends in March; the device's clock (October) is past `max`.
    const now = day(3, 20);
    render(
      <DateRangePicker aria-label="Time range" locale="en-US" now={now} min={day(1, 1)} max={now} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("button", { name: /Time range/ }));
    await user.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(asIso(onValueChange.mock.calls[0]![0])).toEqual(["2026-03-14", "2026-03-20", "last-7-days"]);
  });

  it("Clear empties a committed range: null to the caller, the placeholder, an empty submission", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <form aria-label="form">
        <DateRangePicker
          aria-label="Time range"
          name="period"
          locale="en-US"
          defaultValue={{ start: day(10, 2), end: day(10, 9) }}
          onValueChange={onValueChange}
        />
      </form>,
    );
    const trigger = screen.getByRole("button", { name: /^Time range Oct 2\s–\s9, 2026$/ });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValueChange.mock.calls).toEqual([[null]]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveAccessibleName("Time range Select dates");
    expect(new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement).get("period")).toBe("");
    // Nothing left to clear.
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("follows a controlled open, asking the parent; every opening starts from the committed range", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <DateRangePicker
        aria-label="Time range"
        locale="en-US"
        open={false}
        onOpenChange={onOpenChange}
        defaultValue={{ start: day(10, 1), end: day(10, 7) }}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Time range/ });
    await user.click(trigger);
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <DateRangePicker
        aria-label="Time range"
        locale="en-US"
        open
        onOpenChange={onOpenChange}
        defaultValue={{ start: day(10, 1), end: day(10, 7) }}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Choose a date range" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Start" })).toHaveValue("10/01/2026");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("className styles the root; the trigger is a slot and takes ref and the rest", () => {
    let button: HTMLButtonElement | null = null;
    const { container } = render(
      <DateRangePicker
        aria-label="Time range"
        locale="en-US"
        className="justify-self-start"
        classNames={{ trigger: "w-full" }}
        data-testid="range-trigger"
        ref={(el) => {
          button = el;
        }}
      />,
    );
    const root = container.firstElementChild!;
    expect(root).toHaveClass("justify-self-start");
    const trigger = screen.getByRole("button", { name: /Time range/ });
    expect(root).toContainElement(trigger);
    expect(trigger).not.toHaveClass("justify-self-start");
    expect(trigger).toHaveClass("w-full");
    expect(trigger).toHaveAttribute("data-testid", "range-trigger");
    expect(button).toBe(trigger);
  });

  describe("withTime", () => {
    const form = () => new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement).get("window");
    const at = (v: DateRange<Date>) => [v.start.toString(), v.end.toString()];

    it("a custom range with times of day: wall-clock Dates, an offset ISO interval, the times in the trigger", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form aria-label="form">
          <DateRangePicker aria-label="Window" name="window" locale="en-US" withTime presets={[]} onValueChange={onValueChange} />
        </form>,
      );
      await user.click(screen.getByRole("button", { name: /Window/ }));
      // Until set, a day runs 00:00 to 23:59.
      const startHours = screen.getByRole("spinbutton", { name: "Start time Hours" });
      expect(startHours).toHaveAttribute("aria-valuetext", "12");
      expect(screen.getByRole("spinbutton", { name: "End time Hours" })).toHaveAttribute("aria-valuetext", "11");
      expect(screen.getByRole("spinbutton", { name: "End time Minutes" })).toHaveAttribute("aria-valuetext", "59");

      await user.type(screen.getByRole("textbox", { name: "Start" }), "10/15/2026{Enter}");
      await user.type(screen.getByRole("textbox", { name: "End" }), "10/15/2026{Enter}");
      await user.click(startHours);
      await user.keyboard("900a");
      await user.click(screen.getByRole("spinbutton", { name: "End time Hours" }));
      await user.keyboard("530p");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(onValueChange.mock.calls.map(([v]) => at(v))).toEqual([
        [new Date(2026, 9, 15, 9, 0).toString(), new Date(2026, 9, 15, 17, 30).toString()],
      ]);
      expect(form()).toMatch(/^2026-10-15T09:00[+-]\d\d:\d\d\/2026-10-15T17:30[+-]\d\d:\d\d$/);
      expect(screen.getByRole("button", { name: /Window/ })).toHaveAccessibleName(/^Window Oct 15, 2026, 9:00\sAM\s–\s5:30\sPM$/);

      // Reopening starts from the committed times.
      await user.click(screen.getByRole("button", { name: /Window/ }));
      expect(screen.getByRole("spinbutton", { name: "Start time Hours" })).toHaveAttribute("aria-valuetext", "09");
      expect(screen.getByRole("spinbutton", { name: "End time AM/PM" })).toHaveAttribute("aria-valuetext", "PM");
    });

    it("an end time before the start on one day is refused; an incomplete time blocks Apply", async () => {
      const user = userEvent.setup();
      render(
        <DateRangePicker
          aria-label="Window"
          locale="de-DE"
          withTime
          presets={[]}
          defaultValue={{ start: new Date(2026, 9, 15, 9, 0), end: new Date(2026, 9, 15, 17, 30) }}
        />,
      );
      await user.click(screen.getByRole("button", { name: /Window/ }));
      const apply = screen.getByRole("button", { name: "Apply" });
      expect(apply).toBeEnabled();
      await user.click(screen.getByRole("spinbutton", { name: "End time Hours" }));
      await user.keyboard("08");
      expect(apply).toBeDisabled();
      expect(screen.getByRole("textbox", { name: "End" })).toHaveAccessibleDescription("The end is before the start.");
      expect(screen.getByRole("spinbutton", { name: "End time Hours" })).toHaveAttribute("aria-invalid", "true");
      await user.click(screen.getByRole("spinbutton", { name: "End time Hours" }));
      await user.keyboard("18");
      expect(apply).toBeEnabled();
      await user.keyboard("{ArrowLeft}{Backspace}");
      expect(apply).toBeDisabled();
    });

    it("presets keep times: rolling windows that end now", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DateRangePicker aria-label="Window" locale="en-US" withTime onValueChange={onValueChange} />);
      const trigger = screen.getByRole("button", { name: /Window/ });
      for (const name of ["Last 24 hours", "Last 7 days", "This month"]) {
        await user.click(trigger);
        await user.click(screen.getByRole("button", { name }));
      }
      const now = new Date(2026, 9, 15, 9, 30).toString();
      expect(onValueChange.mock.calls.map(([v]) => [...at(v), v.preset])).toEqual([
        [new Date(2026, 9, 14, 9, 30).toString(), now, "last-24-hours"],
        [new Date(2026, 9, 8, 9, 30).toString(), now, "last-7-days"],
        [new Date(2026, 9, 1).toString(), now, "this-month"],
      ]);
      expect(trigger).toHaveAccessibleName("Window This month");
    });
  });
});
