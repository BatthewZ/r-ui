import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { Radio, RadioGroup } from "./RadioGroup";
import { Form, useForm } from "./use-form";

function Plans(props: Partial<React.ComponentProps<typeof RadioGroup>>) {
  return (
    <RadioGroup aria-label="Plan" {...props}>
      <Radio value="free">Free</Radio>
      <Radio value="team">Team</Radio>
      <Radio value="ent">Enterprise</Radio>
    </RadioGroup>
  );
}

describe("RadioGroup", () => {
  it("is a named radiogroup of radios sharing one name", () => {
    render(<Plans />);
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    const names = new Set(radios.map((r) => r.name));
    expect(names.size).toBe(1);
    expect([...names][0]).not.toBe("");
  });

  it("selects from a label click and reports the value once", async () => {
    const onValueChange = vi.fn();
    render(<Plans defaultValue="free" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByText("Team"));
    expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Free" })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("team");
  });

  it("moves and selects with the arrow keys (the native model)", async () => {
    const onValueChange = vi.fn();
    render(<Plans defaultValue="free" onValueChange={onValueChange} />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Free" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Team" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("team");
  });

  it("is controlled", async () => {
    const onValueChange = vi.fn();
    render(<Plans value="free" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByText("Enterprise"));
    expect(onValueChange).toHaveBeenCalledWith("ent");
    expect(screen.getByRole("radio", { name: "Free" })).toBeChecked();
  });

  it("puts invalid on the group, never on a radio (ARIA allows it on radiogroup only)", () => {
    render(<Plans invalid />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toHaveAttribute("aria-invalid");
  });

  it("disables every radio from the group, or one radio alone", async () => {
    const { rerender } = render(<Plans disabled />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    rerender(
      <RadioGroup aria-label="Plan">
        <Radio value="a">A</Radio>
        <Radio value="b" disabled>
          B
        </Radio>
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "A" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "B" })).toBeDisabled();
  });

  it("read-only keeps the value and says so", async () => {
    const onValueChange = vi.fn();
    render(<Plans readOnly defaultValue="free" onValueChange={onValueChange} />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-readonly", "true");
    await userEvent.click(screen.getByText("Team"));
    expect(screen.getByRole("radio", { name: "Free" })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(0);
  });

  it("marks required on the group and the radios", () => {
    render(<Plans required />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-required", "true");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeRequired();
  });

  it("refuses a Radio outside a RadioGroup", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Radio value="x">X</Radio>)).toThrow(/inside a <RadioGroup>/);
    vi.restoreAllMocks();
  });

  describe("two forms on one page with the same field name", () => {
    const radio = (scope: string, name: string) =>
      within(screen.getByRole("group", { name: scope })).getByRole("radio", { name }) as HTMLInputElement;

    function PlanFields({ label, defaultValue }: { label: string; defaultValue: string }) {
      return (
        <fieldset aria-label={label}>
          <Field name="plan">
            <Field.Label>Plan</Field.Label>
            <RadioGroup defaultValue={defaultValue}>
              <Radio value="free">Free</Radio>
              <Radio value="team">Team</Radio>
            </RadioGroup>
          </Field>
        </fieldset>
      );
    }

    function PlanForm({ label }: { label: string }) {
      const form = useForm<{ plan: string }>({ defaultValues: { plan: "free" }, onSubmit: () => {} });
      return (
        <Form form={form}>
          <PlanFields label={label} defaultValue="free" />
        </Form>
      );
    }

    it("outside a <form>, each group keeps its own selection (no shared browser group)", async () => {
      render(
        <>
          <PlanFields label="Billing" defaultValue="free" />
          <PlanFields label="Trial" defaultValue="free" />
        </>,
      );
      expect(radio("Billing", "Free").checked).toBe(true);
      expect(radio("Trial", "Free").checked).toBe(true);
      expect(radio("Billing", "Free").name).not.toBe(radio("Trial", "Free").name);
      await userEvent.click(radio("Billing", "Team"));
      expect(radio("Billing", "Team").checked).toBe(true);
      expect(radio("Trial", "Free").checked).toBe(true);
    });

    it("inside a <form>, the radios carry the field's name (it submits) and each form keeps its own", async () => {
      render(
        <>
          <PlanForm label="Billing" />
          <PlanForm label="Trial" />
        </>,
      );
      expect(radio("Billing", "Free").name).toBe("plan");
      expect(radio("Trial", "Free").name).toBe("plan");
      await userEvent.click(radio("Billing", "Team"));
      expect(radio("Billing", "Team").checked).toBe(true);
      expect(radio("Trial", "Free").checked).toBe(true);
      expect(new FormData(radio("Billing", "Team").form!).get("plan")).toBe("team");
    });
  });
});
