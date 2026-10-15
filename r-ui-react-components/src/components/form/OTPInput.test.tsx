import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { OTPInput, type OTPInputProps } from "./OTPInput";
import { Form, useForm } from "./use-form";

function Code(props: Partial<OTPInputProps> & { fieldProps?: Partial<React.ComponentProps<typeof Field>> }) {
  const { fieldProps, ...rest } = props;
  return (
    <Field {...fieldProps}>
      <Field.Label>Verification code</Field.Label>
      <OTPInput {...rest} />
      <Field.Description>We sent it to your email.</Field.Description>
    </Field>
  );
}

const NAME = "Verification code , 6 digits";
const input = (name = NAME) => screen.getByRole("textbox", { name });
const boxes = (root: HTMLElement) => [...root.querySelectorAll("[data-otp-box]")].map((box) => box.textContent);
const activeBoxes = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-otp-box]")].flatMap((box, index) => (box.hasAttribute("data-active") ? [index] : []));
const selection = (el: HTMLElement) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd];

describe("OTPInput", () => {
  it("is one textbox named by the Field label and the length, set up for one-time-code autofill", () => {
    render(<Code />);
    const field = input();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveAccessibleDescription("We sent it to your email.");
  });

  it("names itself without a Field, and a caller's aria-label wins over the Field label", () => {
    const { unmount } = render(<OTPInput />);
    expect(screen.getByRole("textbox", { name: NAME })).toBeInTheDocument();
    unmount();
    render(<Code aria-label="Code from your authenticator" mode="alphanumeric" length={8} />);
    const field = screen.getByRole("textbox", { name: "Code from your authenticator , 8 characters" });
    expect(field).toHaveAttribute("inputmode", "text");
  });

  it("advances as you type, keeps only digits, and draws each character in its box", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Code onValueChange={onValueChange} />);
    await user.click(input());
    await user.keyboard("1a2 3");
    expect(input()).toHaveValue("123");
    expect(onValueChange.mock.calls).toEqual([["1"], ["12"], ["123"]]);
    expect(boxes(container)).toEqual(["1", "2", "3", "", "", ""]);
    // The caret sits on the first empty box.
    expect(selection(input())).toEqual([3, 3]);
    expect(activeBoxes(container)).toEqual([3]);
  });

  it("goes back with Backspace, one box at a time", async () => {
    const user = userEvent.setup();
    const { container } = render(<Code defaultValue="123" />);
    await user.click(input());
    await user.keyboard("{End}{Backspace}");
    expect(input()).toHaveValue("12");
    expect(activeBoxes(container)).toEqual([2]);
    await user.keyboard("{Backspace}");
    expect(input()).toHaveValue("1");
    expect(activeBoxes(container)).toEqual([1]);
  });

  it("moves with the arrows, Home and End; a filled box is selected so typing replaces it", async () => {
    const user = userEvent.setup();
    const { container } = render(<Code defaultValue="123456" />);
    await user.click(input());
    await user.keyboard("{End}");
    // Full: the caret rests on the last box, selected.
    expect(selection(input())).toEqual([5, 6]);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(selection(input())).toEqual([3, 4]);
    expect(activeBoxes(container)).toEqual([3]);
    await user.keyboard("9");
    expect(input()).toHaveValue("123956");
    expect(selection(input())).toEqual([4, 5]);
    await user.keyboard("{Home}");
    expect(selection(input())).toEqual([0, 1]);
    await user.keyboard("{ArrowLeft}");
    expect(selection(input())).toEqual([0, 1]);
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(selection(input())).toEqual([2, 3]);
  });

  it("fills every box from a paste, dropping spaces and dashes, and completes exactly once", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onValueChange = vi.fn();
    const { container } = render(<Code onComplete={onComplete} onValueChange={onValueChange} />);
    await user.click(input());
    await user.paste("123 - 456");
    expect(input()).toHaveValue("123456");
    expect(boxes(container)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(onValueChange.mock.calls).toEqual([["123456"]]);
    expect(onComplete.mock.calls).toEqual([["123456"]]);
    // A paste of a whole code replaces a partial one.
    await user.paste("654321");
    expect(input()).toHaveValue("654321");
    expect(onComplete.mock.calls).toEqual([["123456"], ["654321"]]);
  });

  it("puts a short paste in at the caret and ignores one with nothing allowed", async () => {
    const user = userEvent.setup();
    render(<Code defaultValue="12" />);
    await user.click(input());
    await user.keyboard("{End}");
    await user.paste("--");
    expect(input()).toHaveValue("12");
    await user.paste("3-4");
    expect(input()).toHaveValue("1234");
    expect(selection(input())).toEqual([4, 4]);
  });

  it("completes on the typed last character, and again only after the code changes", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Code onComplete={onComplete} length={4} />);
    await user.click(input("Verification code , 4 digits"));
    await user.keyboard("1234");
    expect(onComplete.mock.calls).toEqual([["1234"]]);
    // A refused key on a full code leaves it as it was: no second completion.
    await user.keyboard("x");
    expect(onComplete).toHaveBeenCalledTimes(1);
    await user.keyboard("{End}{Backspace}");
    expect(onComplete).toHaveBeenCalledTimes(1);
    await user.keyboard("4");
    expect(onComplete.mock.calls).toEqual([["1234"], ["1234"]]);
  });

  it("takes an autofilled code in one change event", () => {
    const onComplete = vi.fn();
    render(<Code onComplete={onComplete} />);
    fireEvent.change(input(), { target: { value: "987 654" } });
    expect(input()).toHaveValue("987654");
    expect(onComplete.mock.calls).toEqual([["987654"]]);
    // The same code again (a second autofill) is not a second completion.
    fireEvent.change(input(), { target: { value: "987-654" } });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("masks with a password field and dots, groups with a separator, and stays left-to-right", () => {
    const { container } = render(<Code mask groups={[3, 3]} defaultValue="1234" />);
    const field = container.querySelector("input")!;
    expect(field).toHaveAttribute("type", "password");
    expect(boxes(container)).toEqual(["•", "•", "•", "•", "", ""]);
    expect(container.querySelectorAll(".r-form-otp-separator")).toHaveLength(1);
    expect(field).toHaveAttribute("dir", "ltr");
    expect(container.querySelector("[data-otp-box]")?.parentElement).toHaveAttribute("dir", "ltr");
  });

  it("ignores groups that do not add up to the length", () => {
    const { container } = render(<Code groups={[2, 2]} />);
    expect(container.querySelectorAll(".r-form-otp-separator")).toHaveLength(0);
  });

  it("takes invalid, required and disabled from the Field", () => {
    const { container } = render(<Code fieldProps={{ invalid: true, required: true, disabled: true }} />);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toBeRequired();
    expect(input()).toBeDisabled();
    expect(container.querySelector(".r-form-otp")).toHaveAttribute("data-invalid");
  });

  it("binds to a Form through Field name, with the native name", async () => {
    const user = userEvent.setup();
    let read: () => unknown = () => undefined;
    function Verify() {
      const form = useForm({ defaultValues: { code: "12" } });
      read = () => form.getValues().code;
      return (
        <Form form={form}>
          <Field name="code">
            <Field.Label>Verification code</Field.Label>
            <OTPInput />
          </Field>
        </Form>
      );
    }
    render(<Verify />);
    expect(input()).toHaveValue("12");
    expect(input()).toHaveAttribute("name", "code");
    await user.click(input());
    await user.keyboard("{End}34");
    expect(read()).toBe("1234");
  });
});
