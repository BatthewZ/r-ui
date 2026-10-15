import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { NumberInput } from "./NumberInput";
import { parseLocaleNumber } from "./number-locale";

describe("NumberInput", () => {
  it("is a spinbutton exposing its value and bounds, named by its Field", () => {
    render(
      <Field>
        <Field.Label>Replicas</Field.Label>
        <NumberInput defaultValue={3} min={1} max={10} />
      </Field>,
    );
    const spin = screen.getByRole("spinbutton", { name: "Replicas" });
    expect(spin).toHaveAttribute("aria-valuenow", "3");
    expect(spin).toHaveAttribute("aria-valuemin", "1");
    expect(spin).toHaveAttribute("aria-valuemax", "10");
    expect(spin).toHaveValue("3");
  });

  it("steps with the arrow keys and pages by ten, clamping at the bounds", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" defaultValue={5} min={0} max={20} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    spin.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(spin).toHaveAttribute("aria-valuenow", "6");
    await userEvent.keyboard("{PageUp}");
    expect(spin).toHaveAttribute("aria-valuenow", "16");
    await userEvent.keyboard("{PageUp}");
    expect(spin).toHaveAttribute("aria-valuenow", "20");
    // A press at the bound emits nothing.
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange.mock.calls).toEqual([[6], [16], [20]]);
    await userEvent.keyboard("{Home}");
    expect(spin).toHaveAttribute("aria-valuenow", "0");
    await userEvent.keyboard("{End}");
    expect(spin).toHaveAttribute("aria-valuenow", "20");
  });

  it("commits typed text on blur and on Enter, never mid-typing", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    await userEvent.type(spin, "1234.5");
    expect(onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(1234.5);
    await userEvent.clear(spin);
    await userEvent.type(spin, "42");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(42);
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("displays the committed value locale-formatted and reads typed text in that locale", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" locale="de-DE" defaultValue={1234.5} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    expect(spin).toHaveValue("1.234,5");
    expect(spin).toHaveAttribute("aria-valuetext", "1.234,5");
    await userEvent.clear(spin);
    await userEvent.type(spin, "2.500,75");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenCalledWith(2500.75);
    expect(spin).toHaveValue("2.500,75");
  });

  it("reverts unreadable text and commits an emptied field as null", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" defaultValue={7} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    await userEvent.clear(spin);
    await userEvent.type(spin, "abc");
    await userEvent.tab();
    expect(spin).toHaveValue("7");
    expect(onValueChange).toHaveBeenCalledTimes(0);

    await userEvent.clear(spin);
    await userEvent.tab();
    expect(spin).toHaveValue("");
    expect(spin).not.toHaveAttribute("aria-valuenow");
    expect(onValueChange.mock.calls).toEqual([[null]]);
  });

  it("clamps and rounds what is typed", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" max={100} precision={1} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    await userEvent.type(spin, "3.14159{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(3.1);
    await userEvent.clear(spin);
    await userEvent.type(spin, "500{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(100);
  });

  it("shows the committed value after Enter, not the text that was typed", async () => {
    render(<NumberInput aria-label="N" max={100} precision={1} />);
    const spin = screen.getByRole("spinbutton");
    await userEvent.type(spin, "500{Enter}");
    expect(spin).toHaveAttribute("aria-valuenow", "100");
    expect(spin).toHaveValue("100");
    await userEvent.clear(spin);
    await userEvent.type(spin, "3.14159{Enter}");
    expect(spin).toHaveValue("3.1");
    // Unreadable text stays to be fixed; leaving the field reverts it.
    await userEvent.clear(spin);
    await userEvent.type(spin, "abc{Enter}");
    expect(spin).toHaveValue("abc");
    await userEvent.tab();
    expect(spin).toHaveValue("3.1");
  });

  it("leaves the value alone when the field is focused and left without an edit", async () => {
    const onValueChange = vi.fn();
    render(
      <NumberInput aria-label="N" defaultValue={1.234} formatOptions={{ maximumFractionDigits: 2 }} onValueChange={onValueChange} />,
    );
    const spin = screen.getByRole("spinbutton");
    expect(spin).toHaveValue("1.23");
    await userEvent.click(spin);
    await userEvent.tab();
    await userEvent.click(spin);
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledTimes(0);
    expect(spin).toHaveAttribute("aria-valuenow", "1.234");
  });

  it("steps decimals without float drift", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" defaultValue={0.2} step={0.1} onValueChange={onValueChange} />);
    screen.getByRole("spinbutton").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(0.3);
  });

  it("seeds an empty field at the bound on the first step", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" min={10} onValueChange={onValueChange} />);
    screen.getByRole("spinbutton").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(10);
  });

  it("steps from the stepper buttons, which never take focus and disable at the bounds", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" defaultValue={1} min={0} max={2} onValueChange={onValueChange} />);
    const inc = screen.getByRole("button", { name: "Increase" });
    const dec = screen.getByRole("button", { name: "Decrease" });
    expect(inc).toHaveAttribute("tabindex", "-1");
    await userEvent.click(inc);
    expect(onValueChange).toHaveBeenLastCalledWith(2);
    expect(inc).toBeDisabled();
    expect(inc).not.toHaveFocus();
    await userEvent.click(dec);
    await userEvent.click(dec);
    expect(onValueChange.mock.calls).toEqual([[2], [1], [0]]);
    expect(dec).toBeDisabled();
  });

  it("names its steppers from labels", () => {
    render(<NumberInput aria-label="Menge" labels={{ increment: "Erhöhen", decrement: "Verringern" }} />);
    expect(screen.getByRole("button", { name: "Erhöhen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verringern" })).toBeInTheDocument();
  });

  it("steps from a half-typed draft rather than the stale committed value", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" defaultValue={1} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    await userEvent.clear(spin);
    await userEvent.type(spin, "40");
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(41);
    expect(spin).toHaveValue("41");
  });

  it("is controlled: a refused value snaps back on blur", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="N" value={5} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton");
    await userEvent.clear(spin);
    await userEvent.type(spin, "9");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenCalledWith(9);
    expect(spin).toHaveValue("5");
  });

  it("does nothing when read-only or disabled", async () => {
    const onValueChange = vi.fn();
    render(
      <>
        <NumberInput aria-label="RO" readOnly defaultValue={3} onValueChange={onValueChange} />
        <NumberInput aria-label="Off" disabled defaultValue={3} onValueChange={onValueChange} />
      </>,
    );
    const ro = screen.getByRole("spinbutton", { name: "RO" });
    ro.focus();
    await userEvent.keyboard("{ArrowUp}{PageUp}");
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    expect(ro).toHaveValue("3");
    expect(onValueChange).toHaveBeenCalledTimes(0);
  });

  it("keeps Home/End for the caret when there is no bound", async () => {
    render(<NumberInput aria-label="N" defaultValue={12} />);
    const spin = screen.getByRole("spinbutton") as HTMLInputElement;
    spin.focus();
    await userEvent.keyboard("{Home}");
    expect(spin).toHaveAttribute("aria-valuenow", "12");
  });
});

describe("parseLocaleNumber", () => {
  it("reads each locale's own separators, minus and digits", () => {
    expect(parseLocaleNumber("1,234.5", "en-US")).toBe(1234.5);
    expect(parseLocaleNumber("1.234,5", "de-DE")).toBe(1234.5);
    expect(parseLocaleNumber("-1\u202f234,5", "fr-FR")).toBe(-1234.5);
    expect(parseLocaleNumber("1 234,5", "fr-FR")).toBe(1234.5);
    expect(parseLocaleNumber("\u0661\u0662\u0663", "ar-EG")).toBe(123);
    expect(parseLocaleNumber("\u2212" + "7", "en-US")).toBe(-7);
  });

  it("returns null for empty and NaN for what is not a plain decimal", () => {
    expect(parseLocaleNumber("  ", "en-US")).toBeNull();
    for (const text of ["abc", "1e3", "0x10", "Infinity", "1.2.3", "--1"]) {
      expect(parseLocaleNumber(text, "en-US")).toBeNaN();
    }
  });
});
