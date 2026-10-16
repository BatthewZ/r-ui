import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";

import { CurrencyInput } from "./CurrencyInput";
import { Field } from "./Field";
import { Form, useForm, useFormValue } from "./use-form";

function Amount(props: Partial<React.ComponentProps<typeof CurrencyInput>>) {
  return (
    <Field>
      <Field.Label>Budget</Field.Label>
      <CurrencyInput currency="EUR" {...props} />
    </Field>
  );
}

const amount = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Budget" });

/** Types `text` into a fresh field and leaves it. */
async function enter(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.clear(amount());
  if (text) await user.type(amount(), text);
  await user.tab();
}

describe("CurrencyInput", () => {
  it("reads the locale's separators and formats to the currency's precision on blur", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Amount locale="de-DE" onValueChange={onValueChange} />);
    await user.type(amount(), "1.234,5");
    // Never mid-typing.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(amount()).toHaveValue("1.234,5");
    await user.tab();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(1234.5);
    expect(amount()).toHaveValue("1.234,50");
  });

  it("puts the sign where the locale writes it and describes the field with it", () => {
    const { unmount } = render(<Amount locale="de-DE" defaultValue={12} />);
    const frame = amount().closest(".r-form-frame")!;
    expect(frame.lastElementChild).toHaveTextContent("€");
    expect(amount()).toHaveAccessibleDescription("€");
    unmount();
    render(<Amount locale="en-US" currency="USD" defaultValue={12} />);
    expect(amount().closest(".r-form-frame")!.firstElementChild).toHaveTextContent("$");
    expect(amount()).toHaveValue("12.00");
    expect(amount()).toHaveAttribute("inputmode", "decimal");
  });

  it("takes its precision from the currency", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Amount locale="en-US" currency="JPY" onValueChange={onValueChange} />);
    await enter(user, "1234.6");
    expect(onValueChange).toHaveBeenLastCalledWith(1235);
    expect(amount()).toHaveValue("1,235");
  });

  it("reads its locale from a LocaleProvider", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LocaleProvider locale="de-DE">
        <Amount onValueChange={onValueChange} />
      </LocaleProvider>,
    );
    await enter(user, "99,9");
    expect(onValueChange).toHaveBeenLastCalledWith(99.9);
    expect(amount()).toHaveValue("99,90");
  });

  it("works in minor units when asked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Amount locale="en-US" currency="USD" minorUnits defaultValue={1999} onValueChange={onValueChange} />);
    expect(amount()).toHaveValue("19.99");
    await enter(user, "0.29");
    expect(onValueChange).toHaveBeenLastCalledWith(29);
    expect(amount()).toHaveValue("0.29");
  });

  it("clamps to min and max, and refuses a negative unless allowed", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = render(<Amount locale="en-US" min={5} max={100} defaultValue={50} onValueChange={onValueChange} />);
    await enter(user, "250");
    expect(onValueChange).toHaveBeenLastCalledWith(100);
    await enter(user, "1");
    expect(onValueChange).toHaveBeenLastCalledWith(5);
    await enter(user, "-20");
    // Unreadable as an amount here: the last good value comes back.
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(amount()).toHaveValue("5.00");
    unmount();

    const onAdjust = vi.fn();
    render(<Amount locale="en-US" allowNegative onValueChange={onAdjust} />);
    await enter(user, "-20");
    expect(onAdjust).toHaveBeenLastCalledWith(-20);
    expect(amount()).toHaveValue("-20.00");
    await enter(user, "(12.5)");
    expect(onAdjust).toHaveBeenLastCalledWith(-12.5);
  });

  it("ignores a pasted currency sign and reverts unreadable text", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Amount locale="en-US" currency="USD" defaultValue={10} onValueChange={onValueChange} />);
    await user.clear(amount());
    await user.paste("$1,234.50");
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(1234.5);
    await enter(user, "twelve");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(amount()).toHaveValue("1,234.50");
    await enter(user, "");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(amount()).toHaveValue("");
  });

  it("commits on Enter and shows the committed amount", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <>
          <Amount locale="en-US" value={value} onValueChange={setValue} />
          <output>{String(value)}</output>
        </>
      );
    }
    render(<Controlled />);
    await user.type(amount(), "7.125{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("7.13");
    expect(amount()).toHaveValue("7.13");
    expect(amount()).toHaveFocus();
  });

  it("binds through Field name and submits the number from a hidden input", async () => {
    const user = userEvent.setup();
    let latest: unknown;
    function Probe() {
      latest = useFormValue("budget");
      return null;
    }
    function Plan() {
      const form = useForm({ defaultValues: { budget: 1200 as number | null }, onSubmit: () => {} });
      return (
        <Form form={form}>
          <Field name="budget">
            <Field.Label>Budget</Field.Label>
            <CurrencyInput currency="EUR" locale="de-DE" />
          </Field>
          <Probe />
        </Form>
      );
    }
    const { container } = render(<Plan />);
    expect(amount()).toHaveValue("1.200,00");
    await enter(user, "1.500,25");
    expect(latest).toBe(1500.25);
    expect(container.querySelector('input[type="hidden"][name="budget"]')).toHaveValue("1500.25");
    expect(amount()).not.toHaveAttribute("name");
  });
});
