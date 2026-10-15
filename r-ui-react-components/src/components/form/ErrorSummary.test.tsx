import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorSummary } from "./ErrorSummary";
import { Field } from "./Field";
import { Input } from "./Input";
import { Form, useForm } from "./use-form";

function ServerDown() {
  const form = useForm({
    defaultValues: { name: "cpu" },
    onSubmit: (_values, { setErrors }) => setErrors({ "": "The rule service is unavailable. Try again." }),
  });
  return (
    <Form form={form}>
      <ErrorSummary title="Couldn't save the rule" />
      <Field name="name">
        <Field.Label>Name</Field.Label>
        <Input />
      </Field>
      <button type="submit">Save</button>
    </Form>
  );
}

describe("ErrorSummary", () => {
  it("renders nothing until a submit fails", () => {
    render(<ServerDown />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists an error no field owns as text, and takes focus itself when no field can", async () => {
    render(<ServerDown />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Couldn't save the rule");
    expect(within(summary).getByText("The rule service is unavailable. Try again.")).toBeInTheDocument();
    expect(within(summary).queryByRole("link")).toBeNull();
    await waitFor(() => expect(summary).toHaveFocus());
  });

  it("must sit inside a Form", () => {
    // React reports the thrown error before rethrowing it; keep the output quiet.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ErrorSummary />)).toThrow(/inside a <Form>/);
    spy.mockRestore();
  });
});
