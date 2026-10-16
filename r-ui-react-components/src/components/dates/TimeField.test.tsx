import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Field, Form, useForm } from "../form";
import { TimeField } from "./TimeField";

const spin = (name: string | RegExp) => screen.getByRole("spinbutton", { name });
const values = () => screen.getAllByRole("spinbutton").map((s) => s.getAttribute("aria-valuetext"));
const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

function Native({ children }: { children: ReactNode }) {
  return (
    <form aria-label="form">
      {children}
      <button type="button">elsewhere</button>
    </form>
  );
}
const submitted = (name: string) => new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement).get(name);

describe("TimeField", () => {
  it("is a group of spinbuttons in the locale's order, each named by the field and itself", () => {
    const { unmount } = render(
      <Field>
        <Field.Label>Start</Field.Label>
        <TimeField locale="en-US" defaultValue="21:05" />
        <Field.Description>Local time.</Field.Description>
      </Field>,
    );
    expect(screen.getByRole("group", { name: "Start" })).toHaveAccessibleDescription("Local time.");
    expect(screen.getAllByRole("spinbutton").map((s) => s.getAttribute("aria-label"))).toEqual(["Hours", "Minutes", "AM/PM"]);
    expect(spin("Start Hours")).toHaveAttribute("aria-valuenow", "9");
    expect(spin("Start Hours")).toHaveAttribute("aria-valuemin", "1");
    expect(spin("Start Hours")).toHaveAttribute("aria-valuemax", "12");
    expect(spin("Start Hours")).toHaveAccessibleDescription("Local time.");
    expect(values()).toEqual(["09", "05", "PM"]);
    unmount();

    render(<TimeField aria-label="Alarm" locale="ko-KR" hourCycle={12} defaultValue="09:05" />);
    expect(screen.getAllByRole("spinbutton").map((s) => s.getAttribute("aria-label"))).toEqual(["AM/PM", "Hours", "Minutes"]);
    expect(spin("Alarm Hours")).toHaveAttribute("aria-valuenow", "9");
  });

  it("typing: a digit that cannot start a longer number completes the segment and moves on", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimeField aria-label="Start" locale="de-DE" onValueChange={onValueChange} />);
    expect(values()).toEqual(["Empty", "Empty"]);
    await user.click(spin("Start Hours"));
    await user.keyboard("9");
    expect(spin("Start Minutes")).toHaveFocus();
    await user.keyboard("3");
    // "3" may start 30–39: it waits on the minutes.
    expect(spin("Start Minutes")).toHaveFocus();
    expect(values()).toEqual(["09", "03"]);
    await user.keyboard("5");
    expect(values()).toEqual(["09", "35"]);
    expect(onValueChange.mock.calls).toEqual([["09:03"], ["09:35"]]);

    // "1" waits for 10–19 on a 24-hour clock; "2" after it makes 12.
    await user.click(spin("Start Hours"));
    await user.keyboard("12");
    expect(values()).toEqual(["12", "35"]);
    expect(onValueChange).toHaveBeenLastCalledWith("12:35");
  });

  it("a 12-hour clock: hours 1–12 and A / P, written as 24-hour", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LocaleProvider locale="en-US" labels={{ TimeField: { dayPeriod: "Day period" } }}>
        <TimeField aria-label="Wake" onValueChange={onValueChange} />
      </LocaleProvider>,
    );
    expect(spin("Wake Day period")).toHaveAttribute("aria-valuetext", "Empty");
    await user.click(spin("Wake Hours"));
    await user.keyboard("1030p");
    expect(values()).toEqual(["10", "30", "PM"]);
    expect(onValueChange).toHaveBeenLastCalledWith("22:30");
    await user.keyboard("a");
    expect(onValueChange).toHaveBeenLastCalledWith("10:30");
    // "00" on a 1–12 clock is 12; 12 AM is midnight.
    await user.click(spin("Wake Hours"));
    await user.keyboard("00");
    expect(values()).toEqual(["12", "30", "AM"]);
    expect(onValueChange).toHaveBeenLastCalledWith("00:30");
  });

  it("arrows step and wrap without carrying; the minutes snap to `step`", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimeField aria-label="At" locale="de-DE" defaultValue="23:59" onValueChange={onValueChange} />);
    spin("At Minutes").focus();
    await user.keyboard("{ArrowUp}");
    expect(values()).toEqual(["23", "00"]);
    spin("At Hours").focus();
    await user.keyboard("{ArrowUp}");
    expect(values()).toEqual(["00", "00"]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(values()).toEqual(["22", "00"]);
    await user.keyboard("{End}");
    expect(values()).toEqual(["23", "00"]);
    await user.keyboard("{Home}");
    expect(values()).toEqual(["00", "00"]);
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual(["23:00", "00:00", "23:00", "22:00", "23:00", "00:00"]);
  });

  it("with step 15, the minutes go 07 → 15 up, 07 → 00 down, and wrap 00 → 45", async () => {
    const user = userEvent.setup();
    render(<TimeField aria-label="At" locale="de-DE" step={15} defaultValue="09:07" />);
    spin("At Minutes").focus();
    await user.keyboard("{ArrowDown}");
    expect(values()).toEqual(["09", "00"]);
    // Wrapping keeps the hour: no carry, as a native time field.
    await user.keyboard("{ArrowDown}");
    expect(values()).toEqual(["09", "45"]);
    await user.keyboard("{ArrowUp}");
    expect(values()).toEqual(["09", "00"]);
    // Typing stays exact; the next arrow snaps.
    await user.keyboard("07");
    expect(values()).toEqual(["09", "07"]);
    spin("At Minutes").focus();
    await user.keyboard("{ArrowUp}");
    expect(values()).toEqual(["09", "15"]);
  });

  it("an empty segment starts at its first (Up) or last (Down) value; Left / Right move between segments", async () => {
    const user = userEvent.setup();
    render(<TimeField aria-label="At" locale="en-US" />);
    spin("At Hours").focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}");
    expect(values()).toEqual(["12", "00", "AM"]);
    expect(spin("At AM/PM")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(values()).toEqual(["12", "00", "PM"]);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(spin("At Hours")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(spin("At Hours")).toHaveFocus();
  });

  it("Backspace empties a segment (the value is then null) and, on an empty one, moves back", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimeField aria-label="At" locale="de-DE" defaultValue="09:30" onValueChange={onValueChange} name="at" />);
    spin("At Minutes").focus();
    await user.keyboard("{Backspace}");
    expect(values()).toEqual(["09", "Empty"]);
    expect(spin("At Minutes")).toHaveTextContent("––");
    expect(onValueChange.mock.calls).toEqual([[null]]);
    await user.keyboard("{Backspace}");
    expect(spin("At Hours")).toHaveFocus();
    expect(values()).toEqual(["09", "Empty"]);
    // The half-typed time survives its own null.
    await user.keyboard("{ArrowRight}45");
    expect(values()).toEqual(["09", "45"]);
    expect(onValueChange).toHaveBeenLastCalledWith("09:45");
  });

  it("submits HH:mm (24-hour) under the Field's name; a paste fills every segment", async () => {
    const user = userEvent.setup();
    render(
      <Native>
        <Field name="opens">
          <Field.Label>Opens</Field.Label>
          <TimeField locale="en-US" />
        </Field>
      </Native>,
    );
    expect(submitted("opens")).toBe("");
    spin("Opens Hours").focus();
    await user.paste("14:30");
    expect(values()).toEqual(["02", "30", "PM"]);
    expect(submitted("opens")).toBe("14:30");
    // Text the field cannot read changes nothing.
    await user.paste("half past");
    expect(submitted("opens")).toBe("14:30");
  });

  it("a time outside min / max stays on show, refused with its reason; the value is null", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Field>
        <Field.Label>Active from</Field.Label>
        <TimeField locale="en-US" min="09:00" max="17:30" defaultValue="17:00" onValueChange={onValueChange} />
      </Field>,
    );
    const hours = spin("Active from Hours");
    expect(hours).not.toHaveAttribute("aria-invalid");
    hours.focus();
    await user.keyboard("{ArrowUp}");
    expect(values()).toEqual(["06", "00", "PM"]);
    expect(onValueChange.mock.calls).toEqual([[null]]);
    expect(hours).toHaveAttribute("aria-invalid", "true");
    expect(describedBy(hours).join(" ")).toMatch(/^Choose a time from 9:00\sAM to 5:30\sPM\.$/);
    expect(screen.getByRole("group", { name: "Active from" }).closest("[data-invalid]")).not.toBeNull();
    await user.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith("17:00");
    expect(hours).not.toHaveAttribute("aria-invalid");
    expect(describedBy(hours)).toEqual([]);
  });

  it("a window across midnight (22:00–06:00) allows 23:00 and refuses noon", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimeField aria-label="Quiet" locale="de-DE" min="22:00" max="06:00" onValueChange={onValueChange} />);
    spin("Quiet Hours").focus();
    await user.keyboard("2300");
    expect(onValueChange).toHaveBeenLastCalledWith("23:00");
    spin("Quiet Hours").focus();
    await user.keyboard("12");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(spin("Quiet Hours")).toHaveAttribute("aria-invalid", "true");
  });

  it("leaving with some segments empty says so; editing clears it", async () => {
    const user = userEvent.setup();
    render(
      <Native>
        <TimeField aria-label="At" locale="de-DE" />
      </Native>,
    );
    await user.click(spin("At Hours"));
    await user.keyboard("9");
    // Moving between segments is not leaving.
    expect(describedBy(spin("At Minutes"))).toEqual([]);
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(describedBy(spin("At Minutes"))).toEqual(["Enter a complete time."]);
    expect(spin("At Minutes")).toHaveAttribute("aria-invalid", "true");
    spin("At Minutes").focus();
    await user.keyboard("{ArrowUp}");
    expect(describedBy(spin("At Minutes"))).toEqual([]);
    // An empty field left alone is not incomplete.
    await user.keyboard("{Backspace}{Backspace}{Backspace}");
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(values()).toEqual(["Empty", "Empty"]);
    expect(describedBy(spin("At Minutes"))).toEqual([]);
  });

  it("a controlled value re-seeds the segments; a refused change snaps back", async () => {
    const user = userEvent.setup();
    function Fixed() {
      return <TimeField aria-label="Fixed" locale="de-DE" value="09:30" onValueChange={() => {}} />;
    }
    function Parent() {
      const [value, setValue] = useState<string | null>("08:00");
      return (
        <>
          <TimeField aria-label="Live" locale="de-DE" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue("18:45")}>
            evening
          </button>
          <output>{String(value)}</output>
        </>
      );
    }
    render(
      <>
        <Fixed />
        <Parent />
      </>,
    );
    spin("Fixed Minutes").focus();
    await user.keyboard("{ArrowUp}");
    expect(spin("Fixed Minutes")).toHaveAttribute("aria-valuetext", "30");

    await user.click(screen.getByRole("button", { name: "evening" }));
    expect(spin("Live Hours")).toHaveAttribute("aria-valuetext", "18");
    expect(spin("Live Minutes")).toHaveAttribute("aria-valuetext", "45");
    spin("Live Minutes").focus();
    await user.keyboard("{Backspace}");
    expect(screen.getByText("null")).toBeInTheDocument();
    expect(spin("Live Hours")).toHaveAttribute("aria-valuetext", "18");
  });

  it("disabled segments are no tab stops; read-only ones take focus but not edits", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TimeField aria-label="Off" locale="de-DE" defaultValue="09:30" disabled />
        <TimeField aria-label="Fixed" locale="de-DE" defaultValue="09:30" readOnly />
      </>,
    );
    expect(spin("Off Hours")).not.toHaveAttribute("tabindex");
    expect(spin("Off Hours")).toHaveAttribute("aria-disabled", "true");
    expect(spin("Off Hours")).not.toHaveAttribute("contenteditable");
    await user.tab();
    expect(spin("Fixed Hours")).toHaveFocus();
    await user.keyboard("{ArrowUp}7{Backspace}");
    expect(spin("Fixed Hours")).toHaveAttribute("aria-valuetext", "09");
    expect(spin("Fixed Hours")).toHaveAttribute("aria-readonly", "true");
  });

  it("a touch keyboard's text arrives in beforeinput and is handled, never written to the DOM", () => {
    const onValueChange = vi.fn();
    render(<TimeField aria-label="At" locale="de-DE" defaultValue="09:30" onValueChange={onValueChange} />);
    const minutes = spin("At Minutes");
    act(() => minutes.focus());
    const typed = new InputEvent("beforeinput", { data: "4", inputType: "insertText", cancelable: true, bubbles: true });
    act(() => {
      minutes.dispatchEvent(typed);
    });
    expect(typed.defaultPrevented).toBe(true);
    const second = new InputEvent("beforeinput", { data: "5", inputType: "insertText", cancelable: true, bubbles: true });
    act(() => {
      minutes.dispatchEvent(second);
    });
    expect(onValueChange.mock.calls).toEqual([["09:04"], ["09:45"]]);
    act(() => {
      minutes.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward", cancelable: true, bubbles: true }));
    });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(minutes).toHaveTextContent("––");
  });

  it("binds to a Form through Field name, and the form's reset re-seeds it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    function Rule() {
      const form = useForm({ defaultValues: { from: "09:00" }, onSubmit });
      return (
        <Form form={form} aria-label="rule">
          <Field name="from">
            <Field.Label>From</Field.Label>
            <TimeField locale="de-DE" />
          </Field>
          <button type="submit">Save</button>
          <button type="button" onClick={() => form.reset()}>
            Reset
          </button>
        </Form>
      );
    }
    render(<Rule />);
    expect(spin("From Hours")).toHaveAttribute("aria-valuetext", "09");
    spin("From Hours").focus();
    await user.keyboard("{ArrowUp}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ from: "10:00" });
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(spin("From Hours")).toHaveAttribute("aria-valuetext", "09");
  });

  it("a press on the frame's padding focuses the first empty segment", () => {
    render(<TimeField aria-label="At" locale="de-DE" defaultValue={null} />);
    const group = screen.getByRole("group", { name: "At" });
    fireEvent.mouseDown(group);
    expect(spin("At Hours")).toHaveFocus();
  });
});
