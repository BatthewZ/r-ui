import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";

import { Field } from "./Field";
import { PasswordInput } from "./PasswordInput";
import { estimatePasswordStrength } from "./password-strength";
import { Form, useForm, useFormValue } from "./use-form";

function Password(props: Partial<React.ComponentProps<typeof PasswordInput>>) {
  return (
    <Field>
      <Field.Label>Password</Field.Label>
      <PasswordInput {...props} />
      <Field.Description>At least 12 characters.</Field.Description>
    </Field>
  );
}

const field = () => screen.getByLabelText<HTMLInputElement>("Password", { selector: "input" });
const toggle = () => screen.getByRole("button", { name: "Show password" });

describe("estimatePasswordStrength", () => {
  it("scores by length and variety, and caps the common and the short", () => {
    const score = (password: string) => estimatePasswordStrength(password).score;
    expect(score("abc")).toBe(0);
    expect(score("password1")).toBe(1);
    expect(score("Password123!")).toBe(1);
    expect(score("Tr0ub4dor&3")).toBe(3);
    expect(score("correct horse battery staple")).toBe(4);
    expect(score("Xk9#mQ2$")).toBe(2);
    // A long run of one character is no stronger than a short one.
    expect(score("aaaaaaaaaaaaaaaa")).toBeLessThanOrEqual(1);
  });

  it("explains what would make it stronger", () => {
    expect(estimatePasswordStrength("abc").hints).toEqual([
      "Use at least 8 characters.",
      "Avoid common passwords and words.",
      "Avoid repeated characters and sequences like “abc” or “123”.",
      "Mix upper and lower case letters.",
      "Add a number or a symbol.",
    ]);
    expect(estimatePasswordStrength("correct horse battery staple").hints).toEqual([]);
  });
});

describe("PasswordInput", () => {
  it("is a password field named by its label, with autocomplete passed through", () => {
    render(<Password autoComplete="new-password" />);
    expect(field()).toHaveAttribute("type", "password");
    expect(field()).toHaveAttribute("autocomplete", "new-password");
    expect(field()).toHaveAttribute("spellcheck", "false");
    expect(field()).toHaveAccessibleDescription("At least 12 characters.");
  });

  it("defaults to current-password", () => {
    render(<Password />);
    expect(field()).toHaveAttribute("autocomplete", "current-password");
  });

  it("shows and hides the password, keeping its name, focus, value and caret", async () => {
    const user = userEvent.setup();
    const onVisibleChange = vi.fn();
    render(<Password defaultValue="hunter22" onVisibleChange={onVisibleChange} />);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    await user.click(field());
    // Some browsers throw the caret to the end when an input's type changes; jsdom keeps it. Model the former.
    const input = field();
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "type")!;
    const typeSwaps = vi.fn((value: string) => {
      void value;
      input.setSelectionRange(input.value.length, input.value.length);
    });
    Object.defineProperty(input, "type", {
      configurable: true,
      get: () => native.get!.call(input) as string,
      set: (value: string) => {
        native.set!.call(input, value);
        typeSwaps(value);
      },
    });
    const setAttribute = input.setAttribute.bind(input);
    vi.spyOn(input, "setAttribute").mockImplementation((name: string, value: string) => {
      setAttribute(name, value);
      if (name === "type") typeSwaps(value);
    });
    input.setSelectionRange(3, 5);
    await user.click(toggle());
    // The harness saw the swap (whichever way React writes it), so the reset it models happened.
    expect(typeSwaps).toHaveBeenCalledWith("text");
    expect(field()).toHaveAttribute("type", "text");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(toggle()).toHaveAccessibleName("Show password");
    expect(onVisibleChange).toHaveBeenCalledTimes(1);
    expect(onVisibleChange).toHaveBeenLastCalledWith(true);
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("hunter22");
    expect([field().selectionStart, field().selectionEnd]).toEqual([3, 5]);
    await user.click(toggle());
    expect(field()).toHaveAttribute("type", "password");
    expect([field().selectionStart, field().selectionEnd]).toEqual([3, 5]);
    expect(onVisibleChange).toHaveBeenLastCalledWith(false);
  });

  it("toggles from the keyboard: Tab reaches the button and Space presses it", async () => {
    const user = userEvent.setup();
    render(<Password defaultValue="hunter22" />);
    await user.click(field());
    await user.tab();
    expect(toggle()).toHaveFocus();
    await user.keyboard(" ");
    expect(field()).toHaveAttribute("type", "text");
  });

  it("hides the password again when its form is submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Password defaultValue="hunter22" defaultVisible />
        <button type="submit">Sign in</button>
      </form>,
    );
    expect(field()).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field()).toHaveAttribute("type", "password");
  });

  it("warns while Caps Lock is on, and describes the field with it", () => {
    render(<Password />);
    // The warning line, not the live region that also says it.
    const warning = () => screen.queryByText("Caps Lock is on.", { selector: "p > span" });
    expect(warning()).toBeNull();
    fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
    expect(warning()).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription("Caps Lock is on. At least 12 characters.");
    expect(screen.getByRole("status")).toHaveTextContent("Caps Lock is on.");
    fireEvent.keyUp(field(), { key: "CapsLock", modifierCapsLock: false });
    expect(warning()).toBeNull();
    fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
    fireEvent.blur(field());
    expect(warning()).toBeNull();
  });

  it("can turn the Caps Lock warning off", () => {
    render(<Password capsLockWarning={false} />);
    const warning = () => screen.queryByText("Caps Lock is on.", { selector: "p > span" });
    fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
    expect(warning()).toBeNull();
  });

  it("meters strength as it is typed: a meter with the score in words, hints, announced on change", async () => {
    const user = userEvent.setup();
    render(<Password strength />);
    expect(screen.queryByRole("meter")).toBeNull();
    await user.type(field(), "abc");
    const meter = screen.getByRole("meter", { name: "Password strength" });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "4");
    expect(meter).toHaveAttribute("aria-valuetext", "Very weak");
    expect(meter.querySelectorAll("[data-filled]")).toHaveLength(1);
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription(expect.stringContaining("Very weak Use at least 8 characters."));
    expect(screen.getByRole("status")).toHaveTextContent("Password strength: Very weak");
    await user.clear(field());
    await user.type(field(), "correct horse battery staple");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "Very strong");
    expect(screen.getByRole("meter").querySelectorAll("[data-filled]")).toHaveLength(5);
    expect(screen.getByRole("status")).toHaveTextContent("Password strength: Very strong");
  });

  it("takes a pluggable estimator", async () => {
    const user = userEvent.setup();
    const strength = vi.fn((value: string) => ({
      score: value.length >= 4 ? (3 as const) : (1 as const),
      label: value.length >= 4 ? "Good enough" : "Too short",
      hints: value.length >= 4 ? [] : ["Four characters, please."],
    }));
    render(<Password strength={strength} />);
    await user.type(field(), "abcd");
    expect(strength).toHaveBeenLastCalledWith("abcd");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "Good enough");
    expect(screen.queryByText("Four characters, please.")).toBeNull();
  });

  it("reads its words from a LocaleProvider, the built-in estimator's included", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider
        labels={{
          PasswordInput: {
            show: "Passwort anzeigen",
            strength: "Passwortstärke",
            scores: ["Sehr schwach", "Schwach", "Mittel", "Stark", "Sehr stark"],
          },
        }}
      >
        <PasswordInput aria-label="Passwort" strength />
      </LocaleProvider>,
    );
    await user.type(screen.getByLabelText("Passwort"), "abc");
    expect(screen.getByRole("button", { name: "Passwort anzeigen" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Passwortstärke" })).toHaveAttribute("aria-valuetext", "Sehr schwach");
  });

  it("binds through Field name, and is disabled with its Field", async () => {
    const user = userEvent.setup();
    let latest: unknown;
    function Probe() {
      latest = useFormValue("password");
      return null;
    }
    function Signup({ disabled }: { disabled?: boolean }) {
      const form = useForm({ defaultValues: { password: "" }, onSubmit: () => {} });
      return (
        <Form form={form}>
          <Field name="password" disabled={disabled}>
            <Field.Label>Password</Field.Label>
            <PasswordInput autoComplete="new-password" />
          </Field>
          <Probe />
        </Form>
      );
    }
    const { rerender } = render(<Signup />);
    await user.type(field(), "s3cret");
    expect(latest).toBe("s3cret");
    expect(field()).toHaveAttribute("name", "password");
    rerender(<Signup disabled />);
    expect(field()).toBeDisabled();
    expect(toggle()).toBeDisabled();
  });
});
