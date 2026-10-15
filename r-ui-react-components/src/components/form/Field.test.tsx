import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Field } from "./Field";
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
});
