import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Radio, RadioGroup } from "./RadioGroup";

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
});
