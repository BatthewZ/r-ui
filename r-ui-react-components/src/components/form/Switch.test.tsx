import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("has the switch role, toggles from its label and with Space, reporting each change once", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch onCheckedChange={onCheckedChange}>Live updates</Switch>);
    const toggle = screen.getByRole("switch", { name: "Live updates" });
    expect(toggle).not.toBeChecked();

    await userEvent.click(screen.getByText("Live updates"));
    expect(toggle).toBeChecked();
    toggle.focus();
    await userEvent.keyboard(" ");
    expect(toggle).not.toBeChecked();
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });

  it("is controlled", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch checked onCheckedChange={onCheckedChange}>
        On
      </Switch>,
    );
    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(toggle).toBeChecked();
  });

  it("does not toggle when disabled or read-only", async () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Switch disabled onCheckedChange={onCheckedChange}>
          Off
        </Switch>
        <Switch readOnly onCheckedChange={onCheckedChange}>
          Locked
        </Switch>
      </>,
    );
    await userEvent.click(screen.getByText("Off"));
    await userEvent.click(screen.getByText("Locked"));
    expect(screen.getByRole("switch", { name: "Off" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Locked" })).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByRole("switch", { name: "Locked" })).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(0);
  });

  it("submits like a checkbox: its value when on, nothing when off", async () => {
    const { container } = render(
      <form>
        <Switch name="alerts" value="on">
          Alerts
        </Switch>
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).has("alerts")).toBe(false);
    await userEvent.click(screen.getByRole("switch"));
    expect(new FormData(form).get("alerts")).toBe("on");
  });

  it("is described and marked invalid by a Field", () => {
    render(
      <Field invalid>
        <Switch>Maintenance mode</Switch>
        <Field.Description>Pauses paging.</Field.Description>
      </Field>,
    );
    const toggle = screen.getByRole("switch", { name: "Maintenance mode" });
    expect(toggle).toHaveAccessibleDescription("Pauses paging.");
    expect(toggle).toHaveAttribute("aria-invalid", "true");
  });

  it("is named by aria-label without a visible label", () => {
    render(<Switch aria-label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeInTheDocument();
  });
});
