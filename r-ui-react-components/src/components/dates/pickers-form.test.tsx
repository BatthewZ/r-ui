import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field, Form, useForm } from "../form";
import { DatePicker } from "./DatePicker";
import { type DateRange } from "./date-core";
import { DateRangePicker } from "./DateRangePicker";

const day = (month: number, date: number) => new Date(2026, month - 1, date);

interface Schedule {
  due: Date | null;
  period: DateRange<Date> | null;
}

function Harness({ onSubmit }: { onSubmit: (values: Schedule) => void }) {
  const form = useForm<Schedule>({ defaultValues: { due: day(10, 15), period: { start: day(10, 1), end: day(10, 7) } }, onSubmit });
  return (
    <Form form={form} aria-label="schedule">
      <Field name="due">
        <Field.Label>Due date</Field.Label>
        <DatePicker locale="en-US" />
        <Field.Error />
      </Field>
      <Field name="period">
        <Field.Label>Report period</Field.Label>
        <DateRangePicker locale="en-US" />
      </Field>
      <button type="button" onClick={() => form.setErrors({ due: "Past the release freeze" })}>
        server
      </button>
      <button type="submit">Save</button>
    </Form>
  );
}

describe("date pickers in a Form", () => {
  it("bind by the Field's name: show the form's dates, write typed ones back, submit Dates", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const due = screen.getByRole("textbox", { name: "Due date" });
    expect(due).toHaveValue("10/15/2026");
    expect(screen.getByRole("button", { name: /^Report period Oct 1\s–\s7, 2026$/ })).toBeInTheDocument();
    // Native submission uses the Field's path, as ISO dates.
    const data = new FormData(screen.getByRole("form", { name: "schedule" }) as HTMLFormElement);
    expect(data.get("due")).toBe("2026-10-15");
    expect(data.get("period")).toBe("2026-10-01/2026-10-07");

    await user.clear(due);
    // Enter commits the typed date (the picker's own use of it); then submit.
    await user.type(due, "10/20/2026{Enter}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ due: day(10, 20), period: { start: day(10, 1), end: day(10, 7) } });
  });

  it("shows a refused entry beside the form's own error, and marks the Field invalid", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => {}} />);
    await user.click(screen.getByRole("button", { name: "server" }));
    const due = screen.getByRole("textbox", { name: "Due date" });
    expect(due).toHaveAccessibleDescription("MM/DD/YYYY Past the release freeze");
    await user.clear(due);
    await user.type(due, "not a date{Enter}");
    // A refused entry leaves the value as it was, so the form's message stays, beside the refusal.
    expect(due).toHaveAttribute("aria-invalid", "true");
    const described = (due.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toHaveLength(2);
    expect(described[0]).toMatch(/not a date/i);
    expect(described[1]).toBe("Past the release freeze");
  });

  it("tells a plain Field (no form) that a refused entry makes it invalid", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Field>
        <Field.Label>Due date</Field.Label>
        <DatePicker locale="en-US" />
      </Field>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toHaveAttribute("data-invalid");
    await user.type(screen.getByRole("textbox", { name: "Due date" }), "not a date{Enter}");
    expect(root).toHaveAttribute("data-invalid", "");
  });
});
