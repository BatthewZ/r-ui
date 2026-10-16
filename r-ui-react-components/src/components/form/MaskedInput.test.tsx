import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { MaskedInput } from "./MaskedInput";
import { Form, useForm, useFormValue } from "./use-form";

const PHONE = "(999) 999-9999";

function Phone(props: Partial<React.ComponentProps<typeof MaskedInput>>) {
  return (
    <Field>
      <Field.Label>Phone</Field.Label>
      <MaskedInput mask={PHONE} {...props} />
    </Field>
  );
}

const input = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Phone" });
/** The field's text with `|` at the caret. */
const withCaret = () => {
  const el = input();
  const at = el.selectionStart ?? el.value.length;
  return `${el.value.slice(0, at)}|${el.value.slice(at)}`;
};
const placeCaret = (at: number, end = at) => input().setSelectionRange(at, end);

describe("MaskedInput", () => {
  it("formats as it is typed, reporting raw and formatted, and completes once", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onComplete = vi.fn();
    render(<Phone onValueChange={onValueChange} onComplete={onComplete} />);
    expect(input()).toHaveAttribute("placeholder", "(___) ___-____");
    expect(input()).toHaveAttribute("inputmode", "numeric");
    expect(input()).toHaveAttribute("dir", "ltr");
    await user.type(input(), "555");
    expect(withCaret()).toBe("(555) |");
    await user.type(input(), "1234567");
    expect(input()).toHaveValue("(555) 123-4567");
    expect(onValueChange).toHaveBeenLastCalledWith("5551234567", "(555) 123-4567");
    expect(onValueChange).toHaveBeenCalledTimes(10);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("5551234567", "(555) 123-4567");
    // A character past the last slot is dropped and changes nothing.
    await user.keyboard("8");
    expect(input()).toHaveValue("(555) 123-4567");
    expect(onValueChange).toHaveBeenCalledTimes(10);
  });

  it("inserts mid-string and keeps the caret after the new character", async () => {
    const user = userEvent.setup();
    render(<Phone defaultValue="5551234" />);
    await user.click(input());
    placeCaret(2);
    await user.keyboard("9");
    expect(withCaret()).toBe("(59|5) 512-34");
  });

  it("refuses a character the slot does not take without moving the caret", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Phone defaultValue="5551" onValueChange={onValueChange} />);
    await user.click(input());
    placeCaret(3);
    await user.keyboard("x");
    expect(withCaret()).toBe("(55|5) 1");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("deletes mid-string, and Backspace over a literal deletes the digit before it", async () => {
    const user = userEvent.setup();
    render(<Phone defaultValue="5551234" />);
    await user.click(input());
    placeCaret(8);
    await user.keyboard("{Backspace}");
    expect(withCaret()).toBe("(555) 1|34-");
    placeCaret(6);
    await user.keyboard("{Backspace}");
    expect(withCaret()).toBe("(55|1) 34");
    placeCaret(1);
    await user.keyboard("{Delete}");
    expect(withCaret()).toBe("(|513) 4");
  });

  it("pastes over a selection and keeps only what fits the slots", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Phone defaultValue="5551234567" onValueChange={onValueChange} />);
    await user.click(input());
    placeCaret(1, 9);
    await user.paste("212-867");
    expect(withCaret()).toBe("(212) 867-|4567");
    expect(onValueChange).toHaveBeenLastCalledWith("2128674567", "(212) 867-4567");
  });

  it("leaves IME composition alone until it commits", () => {
    render(<MaskedInput aria-label="Plate" mask="AAA-999" />);
    const plate = screen.getByRole<HTMLInputElement>("textbox", { name: "Plate" });
    expect(plate).toHaveAttribute("inputmode", "text");
    expect(plate).not.toHaveAttribute("dir");
    fireEvent.compositionStart(plate);
    fireEvent.change(plate, { target: { value: "a1" } });
    // Mid-composition the text is not refitted (the "1" would be refused by a letter slot).
    expect(plate).toHaveValue("a1");
    plate.setSelectionRange(2, 2);
    fireEvent.compositionEnd(plate);
    expect(plate).toHaveValue("a");
  });

  it("takes custom tokens with a transform", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <MaskedInput
        aria-label="Colour"
        mask="#hhhhhh"
        tokens={{ h: { test: (c) => /^[0-9a-f]$/i.test(c), transform: (c) => c.toUpperCase() } }}
        onValueChange={onValueChange}
      />,
    );
    const colour = screen.getByRole("textbox", { name: "Colour" });
    expect(colour).toHaveAttribute("placeholder", "#______");
    await user.type(colour, "1a2gB3");
    expect(colour).toHaveValue("#1A2B3");
    expect(onValueChange).toHaveBeenLastCalledWith("1A2B3", "#1A2B3");
  });

  it("is controlled by its raw value", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [raw, setRaw] = useState("12");
      return (
        <>
          <MaskedInput aria-label="Expiry" mask="99/99" value={raw} onValueChange={setRaw} />
          <output>{raw}</output>
        </>
      );
    }
    render(<Controlled />);
    const expiry = screen.getByRole("textbox", { name: "Expiry" });
    expect(expiry).toHaveValue("12/");
    await user.type(expiry, "27");
    expect(expiry).toHaveValue("12/27");
    expect(screen.getByRole("status")).toHaveTextContent("1227");
  });

  it("binds through Field name: the form holds the raw text, and a hidden input submits it", async () => {
    const user = userEvent.setup();
    let latest: unknown;
    function Probe() {
      latest = useFormValue("phone");
      return null;
    }
    function Signup() {
      const form = useForm({ defaultValues: { phone: "5551234" }, onSubmit: () => {} });
      return (
        <Form form={form}>
          <Field name="phone">
            <Field.Label>Phone</Field.Label>
            <MaskedInput mask={PHONE} />
          </Field>
          <Probe />
        </Form>
      );
    }
    const { container } = render(<Signup />);
    expect(input()).toHaveValue("(555) 123-4");
    await user.type(input(), "567");
    expect(latest).toBe("5551234567");
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="phone"]');
    expect(hidden).toHaveValue("5551234567");
    expect(input()).not.toHaveAttribute("name");
  });
});
