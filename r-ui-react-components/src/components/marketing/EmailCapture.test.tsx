import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { EmailCapture } from "./EmailCapture";

/** A promise the test settles by hand, to hold the form in its pending state. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const field = () => screen.getByRole("textbox", { name: "Email address" });
const submit = () => screen.getByRole("button", { name: "Subscribe" });
const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe("EmailCapture", () => {
  it("is an email field (autocomplete email) and a submit button, inside a form", () => {
    render(<EmailCapture onSubmit={vi.fn()} />);
    expect(field()).toHaveAttribute("type", "email");
    expect(field()).toHaveAttribute("autocomplete", "email");
    expect(field()).toHaveAttribute("name", "email");
    expect(field()).toBeRequired();
    expect(submit()).toHaveAttribute("type", "submit");
    expect(field().closest("form")).toBe(submit().closest("form"));
  });

  it("an empty or invalid address is the Field's error, focus on the field, and onSubmit is not called", async () => {
    const onSubmit = vi.fn();
    render(<EmailCapture onSubmit={onSubmit} />);
    await userEvent.click(submit());
    await waitFor(() => expect(field()).toHaveFocus());
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(describedBy(field())).toContain("Enter your email address.");

    await userEvent.type(field(), "not-an-address");
    await userEvent.click(submit());
    await waitFor(() => expect(describedBy(field())).toContain("Enter an email address like name@example.com."));
    expect(field()).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    // The error clears as it is fixed.
    await userEvent.clear(field());
    await userEvent.type(field(), "ada@example.com");
    await waitFor(() => expect(field()).not.toHaveAttribute("aria-invalid"));
  });

  it("pending: the button is busy and a second press does nothing; success replaces the form with a focused, announced message", async () => {
    const pending = deferred();
    const onSubmit = vi.fn(() => pending.promise);
    render(<EmailCapture onSubmit={onSubmit} />);
    const status = screen.getByRole("status");
    // The live region is there before anything is said in it.
    expect(status).toBeEmptyDOMElement();

    await userEvent.type(field(), "  ada@example.com ");
    await userEvent.click(submit());
    await waitFor(() => expect(submit()).toHaveAttribute("aria-busy", "true"));
    await userEvent.click(submit());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("ada@example.com", { consent: false });

    await act(async () => pending.resolve());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("You are subscribed"));
    expect(screen.getByRole("status")).toHaveTextContent("We sent a confirmation to ada@example.com.");
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveFocus();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a rejection is the field's error with focus on the field, and the next press retries without an edit", async () => {
    const attempts = [deferred(), deferred()];
    const onSubmit = vi.fn(() => attempts[onSubmit.mock.calls.length - 1]!.promise);
    render(<EmailCapture onSubmit={onSubmit} />);
    await userEvent.type(field(), "ada@example.com");
    await userEvent.click(submit());
    await act(async () => attempts[0]!.reject(new Error("503")));

    await waitFor(() => expect(describedBy(field())).toContain("We could not subscribe you just now. Try again."));
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("ada@example.com");
    expect(submit()).not.toHaveAttribute("aria-busy");

    await userEvent.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    // The old message goes as the retry starts.
    expect(field()).not.toHaveAttribute("aria-invalid");
    await act(async () => attempts[1]!.resolve());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("You are subscribed"));
  });

  it("the failure message can say what went wrong (the label receives the rejection)", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("Already subscribed")));
    render(
      <EmailCapture onSubmit={onSubmit} labels={{ failed: (error) => (error instanceof Error ? error.message : "Failed") }} />,
    );
    await userEvent.type(field(), "ada@example.com{Enter}");
    await waitFor(() => expect(describedBy(field())).toContain("Already subscribed"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("a consent box, when given, must be ticked; its state reaches onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<EmailCapture onSubmit={onSubmit} consent="Send me product news" />);
    const box = screen.getByRole("checkbox", { name: "Send me product news" });
    expect(box).toBeRequired();
    await userEvent.type(field(), "ada@example.com");
    await userEvent.click(submit());
    await waitFor(() => expect(box).toHaveFocus());
    expect(describedBy(box)).toContain("Tick the box to agree before subscribing.");
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(box);
    await userEvent.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("ada@example.com", { consent: true });
  });

  it("an optional consent box does not block; its state still reaches onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<EmailCapture onSubmit={onSubmit} consent="Also send tips" consentRequired={false} />);
    expect(screen.getByRole("checkbox", { name: "Also send tips" })).not.toBeRequired();
    await userEvent.type(field(), "ada@example.com{Enter}");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("ada@example.com", { consent: false });
  });

  it("a filled honeypot shows success without calling onSubmit; the honeypot is out of reach", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<EmailCapture onSubmit={onSubmit} honeypot="company" />);
    const trap = container.querySelector<HTMLInputElement>('input[name="company"]')!;
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap).toHaveAttribute("autocomplete", "off");
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
    // Hidden from assistive tech: the only textbox is the email field.
    expect(screen.getAllByRole("textbox")).toEqual([field()]);

    await userEvent.type(field(), "bot@example.com");
    trap.value = "Acme";
    await userEvent.click(submit());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("You are subscribed"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Tab walks the field, the button and the consent box, and never stops on the honeypot", async () => {
    const user = userEvent.setup();
    render(
      <>
        <EmailCapture onSubmit={vi.fn()} consent="Send me product news" honeypot />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(field()).toHaveFocus();
    await user.tab();
    expect(submit()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Send me product news" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("an empty honeypot lets a person through", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<EmailCapture onSubmit={onSubmit} honeypot />);
    expect(container.querySelector('input[name="website"]')).not.toBeNull();
    await userEvent.type(field(), "ada@example.com{Enter}");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("inline from a 28rem container, stacked below it (the form's own width)", () => {
    const { container } = render(<EmailCapture onSubmit={vi.fn()} />);
    expect(container.firstElementChild).toHaveClass("@container");
    expect(field().closest(".grid")?.parentElement?.closest(".grid")).not.toBeNull();
    const row = submit().parentElement!;
    expect(row).toHaveClass("@md:grid-cols-[minmax(0,1fr)_auto]");
    expect(row).toContainElement(field());
  });

  it("hideLabel keeps the name but hides the label; description describes the field", () => {
    render(<EmailCapture onSubmit={vi.fn()} hideLabel description="Monthly. Unsubscribe any time." />);
    expect(screen.getByText("Email address")).toHaveClass("sr-only");
    expect(field()).toBeInTheDocument();
    expect(describedBy(field())).toEqual(["Monthly. Unsubscribe any time."]);
  });

  it("disabled: the field and the button", () => {
    render(<EmailCapture onSubmit={vi.fn()} disabled consent="Agree" />);
    expect(field()).toBeDisabled();
    expect(submit()).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeDisabled();
  });

  it("reads its words from the LocaleProvider, the instance's labels over them", () => {
    render(
      <LocaleProvider labels={{ EmailCapture: { email: "E-Mail-Adresse", submit: "Abonnieren" } }}>
        <EmailCapture onSubmit={vi.fn()} labels={{ submit: "Jetzt abonnieren" }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("textbox", { name: "E-Mail-Adresse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jetzt abonnieren" })).toBeInTheDocument();
  });
});
