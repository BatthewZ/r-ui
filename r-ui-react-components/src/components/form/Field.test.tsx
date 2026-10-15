import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import { Field, useField, useFieldMessage } from "./Field";
import { Form, useForm } from "./use-form";
import { Input } from "./Input";
import { Radio, RadioGroup } from "./RadioGroup";

describe("Field", () => {
  it("names the control by its label and describes it by its description", () => {
    render(
      <Field>
        <Field.Label>Email</Field.Label>
        <Input />
        <Field.Description>We never share it.</Field.Description>
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAccessibleDescription("We never share it.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and describes it with the error once an error has content", async () => {
    function Harness() {
      const [error, setError] = useState<string | undefined>(undefined);
      return (
        <>
          <Field>
            <Field.Label>Email</Field.Label>
            <Input />
            <Field.Description>Work address.</Field.Description>
            <Field.Error>{error}</Field.Error>
          </Field>
          <button type="button" onClick={() => setError(error ? undefined : "Enter a valid email")}>
            toggle
          </button>
        </>
      );
    }
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Email" });
    // Positive control: with no error, nothing dangles and nothing is invalid.
    expect(input).toHaveAccessibleDescription("Work address.");
    expect(input).not.toHaveAttribute("aria-invalid");

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Work address. Enter a valid email");

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.queryByText("Enter a valid email")).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Work address.");
  });

  it("references no description when none rendered", () => {
    render(
      <Field>
        <Field.Label>Name</Field.Label>
        <Input />
        <Field.Description>{null}</Field.Description>
        <Field.Error>{""}</Field.Error>
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Name" })).not.toHaveAttribute("aria-describedby");
  });

  it("follows a caller's own control id and merges a caller's aria-describedby", () => {
    render(
      <>
        <p id="hint">External hint</p>
        <Field>
          <Field.Label>Host</Field.Label>
          <Input id="host-input" aria-describedby="hint" />
          <Field.Description>Without the scheme.</Field.Description>
        </Field>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Host" });
    expect(input).toHaveAttribute("id", "host-input");
    expect(input).toHaveAccessibleDescription("External hint Without the scheme.");
  });

  it("marks required on the control and keeps the star out of the name", () => {
    render(
      <Field required>
        <Field.Label>Email</Field.Label>
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toBeRequired();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("cascades disabled and read-only, and the control's own prop wins in both directions", () => {
    render(
      <>
        <Field disabled>
          <Field.Label>A</Field.Label>
          <Input />
        </Field>
        <Field disabled>
          <Field.Label>B</Field.Label>
          <Input disabled={false} />
        </Field>
        <Field readOnly>
          <Field.Label>C</Field.Label>
          <Input />
        </Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "A" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "B" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "C" })).toHaveAttribute("readonly");
  });

  it("lets `invalid` override the error-derived state, and the control's own `invalid` override the Field", () => {
    render(
      <>
        <Field invalid={false}>
          <Field.Label>Quiet</Field.Label>
          <Input />
          <Field.Error>Shown, but not invalid</Field.Error>
        </Field>
        <Field invalid>
          <Field.Label>Loud</Field.Label>
          <Input />
        </Field>
        <Field invalid>
          <Field.Label>Override</Field.Label>
          <Input invalid={false} />
        </Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Quiet" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("textbox", { name: "Loud" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Override" })).not.toHaveAttribute("aria-invalid");
  });

  it("names a group control (which a <label for> cannot) by aria-labelledby", () => {
    render(
      <Field>
        <Field.Label>Plan</Field.Label>
        <RadioGroup>
          <Radio value="free">Free</Radio>
          <Radio value="pro">Pro</Radio>
        </RadioGroup>
        <Field.Error>Choose a plan</Field.Error>
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Plan" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Choose a plan");
  });

  it("gives the error an icon and a text, never colour alone", () => {
    render(
      <Field>
        <Field.Label>X</Field.Label>
        <Input />
        <Field.Error>Required</Field.Error>
      </Field>,
    );
    const error = screen.getByText("Required").closest("p");
    expect(error?.querySelector("svg")).not.toBeNull();
    expect(error).toHaveTextContent("Required");
  });

  it("marks the layout's orientation for the container query", () => {
    const { container } = render(
      <Field orientation="horizontal" className="caller">
        <Field.Label>Name</Field.Label>
        <Input />
      </Field>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("@container", "caller");
    expect(root.firstElementChild).toHaveAttribute("data-orientation", "horizontal");
  });

  it("works with a label click: focuses the control", async () => {
    render(
      <Field>
        <Field.Label>City</Field.Label>
        <Input />
      </Field>,
    );
    await userEvent.click(screen.getByText("City"));
    expect(screen.getByRole("textbox", { name: "City" })).toHaveFocus();
  });

  it("outside a Form, a name only names the control for native submission", () => {
    render(
      <Field name="contact.email">
        <Field.Label>Email</Field.Label>
        <Input defaultValue="ops@example.com" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("name", "contact.email");
    // Still the caller's uncontrolled input: nothing bound it.
    expect(input).toHaveValue("ops@example.com");
  });

  it("inside a Form, Field.Error's own content wins over the form's message", async () => {
    function Harness({ own }: { own?: string }) {
      const form = useForm({ defaultValues: { email: "" } });
      return (
        <Form form={form}>
          <Field name="email">
            <Field.Label>Email</Field.Label>
            <Input />
            <Field.Error>{own}</Field.Error>
          </Field>
          <button type="button" onClick={() => form.setErrors({ email: "From the server" })}>
            server
          </button>
        </Form>
      );
    }
    const { rerender } = render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "server" }));
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAccessibleDescription("From the server");
    rerender(<Harness own="Use your work address" />);
    expect(input).toHaveAccessibleDescription("Use your work address");
    expect(screen.queryByText("From the server")).toBeNull();
  });

  it("describes the control by the form's message in the same commit the message appears", async () => {
    let describedAtFocus: string | null = "not focused";
    // Focus moved from an effect of the commit that rendered the error, as Form does after a failed submit.
    function FocusWhenInvalid() {
      const field = useField();
      const error = field?.binding?.error;
      useEffect(() => {
        if (error) document.getElementById(field?.controlId ?? "")?.focus();
      }, [error, field?.controlId]);
      return null;
    }
    function Harness() {
      const form = useForm({ defaultValues: { name: "" } });
      return (
        <Form form={form}>
          <Field name="name">
            <Field.Label>Name</Field.Label>
            <Input onFocus={(event) => (describedAtFocus = event.currentTarget.getAttribute("aria-describedby"))} />
            <Field.Error />
            <FocusWhenInvalid />
          </Field>
          <button type="button" onClick={() => form.setErrors({ name: "Taken" })}>
            server
          </button>
        </Form>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "server" }));
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveFocus();
    expect(describedAtFocus).toBe(screen.getByText("Taken").closest("p")?.id);
  });

  it("is the field's blur only when focus leaves the whole Field", async () => {
    function Harness() {
      const form = useForm({ defaultValues: { code: "" } });
      return (
        <Form form={form}>
          <Field name="code">
            <Field.Label>Code</Field.Label>
            <Input end={<button type="button">Paste</button>} />
            <Touched />
          </Field>
          <button type="button">Elsewhere</button>
        </Form>
      );
    }
    function Touched() {
      return <span>{useField()?.binding?.touched ? "touched" : "untouched"}</span>;
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("textbox", { name: "Code" }));
    await userEvent.click(screen.getByRole("button", { name: "Paste" }));
    expect(screen.getByText("untouched")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.getByText("touched")).toBeInTheDocument();
  });

  it("keeps several messages: each describes the control, and removing one keeps the rest", async () => {
    function Harness() {
      const [own, setOwn] = useState(true);
      return (
        <>
          <Field>
            <Field.Label>Date</Field.Label>
            <Input />
            <Field.Description>Day first.</Field.Description>
            <Field.Error>Required by the schedule</Field.Error>
            {own && <Field.Error>Not a date</Field.Error>}
          </Field>
          <button type="button" onClick={() => setOwn(false)}>
            drop
          </button>
        </>
      );
    }
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Date" });
    expect(input).toHaveAccessibleDescription("Day first. Required by the schedule Not a date");
    await userEvent.click(screen.getByRole("button", { name: "drop" }));
    expect(input).toHaveAccessibleDescription("Day first. Required by the schedule");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("lets a control register a message it renders itself, named once even when it names it too", () => {
    function DateLike({ error }: { error?: string }) {
      const id = "own-error";
      useFieldMessage("error", id, error !== undefined);
      return (
        <>
          <Input aria-describedby={error ? id : undefined} />
          {error && <p id={id}>{error}</p>}
        </>
      );
    }
    const { rerender } = render(
      <Field>
        <Field.Label>When</Field.Label>
        <DateLike />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "When" });
    expect(input).not.toHaveAttribute("aria-invalid");
    rerender(
      <Field>
        <Field.Label>When</Field.Label>
        <DateLike error="Not a date" />
      </Field>,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "own-error");
    expect(input).toHaveAccessibleDescription("Not a date");
  });
});
