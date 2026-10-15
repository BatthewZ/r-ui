import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "../form";
import { toISODate } from "./date-core";
import { DatePicker } from "./DatePicker";

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d);
const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
});
afterEach(() => vi.useRealTimers());

function Form({ locale, onValueChange }: { locale: string; onValueChange?: (d: Date | null) => void }) {
  return (
    <form aria-label="form">
      <Field>
        <Field.Label>Due date</Field.Label>
        <DatePicker name="due" locale={locale} onValueChange={onValueChange} />
        <Field.Description>When it ships.</Field.Description>
      </Field>
      <button type="button">elsewhere</button>
    </form>
  );
}
const submitted = () => new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement).get("due");

describe("DatePicker", () => {
  it("is a Field control: labelled, described by the Field and the visible format hint", () => {
    render(<Form locale="en-US" />);
    const input = screen.getByRole("textbox", { name: "Due date" });
    expect(describedBy(input)).toEqual(["MM/DD/YYYY", "When it ships."]);
    expect(screen.getByText("MM/DD/YYYY")).toBeVisible();
  });

  it.each([
    ["en-US", "10/15/2026", "10/15/2026"],
    ["de-DE", "15.10.2026", "15.10.2026"],
    ["en-US", "2026-10-15", "10/15/2026"],
    ["de-DE", "15. Oktober 2026", "15.10.2026"],
  ])("%s: typed %s commits on blur, submits ISO and shows %s", async (locale, typed, shown) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Form locale={locale} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Due date" });
    await user.type(input, typed);
    expect(onValueChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onValueChange.mock.calls.map(([d]) => toISODate(d))).toEqual(["2026-10-15"]);
    expect(input).toHaveValue(shown);
    expect(submitted()).toBe("2026-10-15");
  });

  it("refuses unreadable text: keeps it, marks the field invalid, says why through aria-describedby", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Form locale="en-US" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Due date" });
    await user.type(input, "15.10.2026{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("15.10.2026");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(describedBy(input)).toEqual(["“15.10.2026” is not a date. Use MM/DD/YYYY.", "When it ships."]);
    expect(submitted()).toBe("");
    // Editing clears the reason.
    await user.clear(input);
    await user.type(input, "10/16/2026{Enter}");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(onValueChange.mock.calls.map(([d]) => toISODate(d))).toEqual(["2026-10-16"]);
  });

  it("refuses dates outside the bounds and unavailable ones, naming the rule", async () => {
    const user = userEvent.setup();
    render(
      <Field>
        <Field.Label>Delivery</Field.Label>
        <DatePicker locale="en-US" min={day(10, 5)} max={day(11, 20)} isDateUnavailable={(d) => d.getDay() === 0} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Delivery" });
    await user.type(input, "12/01/2026{Enter}");
    expect(describedBy(input)).toEqual(["Choose a date from Oct 5, 2026 to Nov 20, 2026."]);
    await user.clear(input);
    await user.type(input, "10/18/2026{Enter}");
    expect(describedBy(input)).toEqual(["Oct 18, 2026 is not available."]);
  });

  it("Enter with nothing pending is left to the form (implicit submission)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault());
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
        <DatePicker aria-label="Due" locale="en-US" defaultValue={day(10, 2)} />
        <button type="submit">Save</button>
      </form>,
    );
    await user.click(screen.getByRole("textbox", { name: "Due" }));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("blank commits null", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker aria-label="Due" locale="en-US" defaultValue={day(10, 2)} onValueChange={onValueChange} />);
    await user.clear(screen.getByRole("textbox", { name: "Due" }));
    await user.tab();
    expect(onValueChange.mock.calls).toEqual([[null]]);
  });

  it("opens the calendar on the chosen day, picks, closes and returns focus to the button", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker aria-label="Due" locale="en-US" defaultValue={day(10, 20)} onValueChange={onValueChange} />);
    const button = screen.getByRole("button", { name: "Choose date" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(button);
    const dialog = screen.getByRole("dialog", { name: "Choose date" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: /October 20, 2026/ })).toHaveFocus());
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{ArrowRight}{Enter}");
    expect(onValueChange.mock.calls.map(([d]) => toISODate(d))).toEqual(["2026-10-21"]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Due" })).toHaveValue("10/21/2026");
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("Escape closes the calendar without choosing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker aria-label="Due" locale="en-US" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Choose date" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /October 15, 2026, today/ })).toHaveFocus());
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("a disabled or read-only Field disables the field, the button and the submitted value", () => {
    render(
      <form aria-label="form">
        <Field disabled>
          <Field.Label>Due date</Field.Label>
          <DatePicker name="due" locale="en-US" defaultValue={day(10, 2)} />
        </Field>
        <Field readOnly>
          <Field.Label>Created</Field.Label>
          <DatePicker locale="en-US" defaultValue={day(10, 2)} />
        </Field>
      </form>,
    );
    expect(screen.getByRole("textbox", { name: "Due date" })).toBeDisabled();
    const [disabledButton, readOnlyButton] = screen.getAllByRole("button", { name: "Choose date" });
    expect(disabledButton).toBeDisabled();
    expect(readOnlyButton).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Created" })).toHaveAttribute("readonly");
    expect(submitted()).toBeNull();
  });
});
