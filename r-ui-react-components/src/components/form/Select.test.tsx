import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { Select } from "./Select";

const options = (
  <>
    <option value="eu">Europe</option>
    <option value="us">United States</option>
  </>
);

describe("Select", () => {
  it("is a native combobox named by its Field label", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Region</Field.Label>
        <Select onChange={(e) => onChange(e.target.value)}>{options}</Select>
      </Field>,
    );
    const select = screen.getByRole("combobox", { name: "Region" });
    expect(select.tagName).toBe("SELECT");
    await userEvent.selectOptions(select, "us");
    expect(select).toHaveValue("us");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("us");
  });

  it("starts on the placeholder when there is no value, and the placeholder cannot be re-picked", () => {
    render(
      <Select aria-label="Region" placeholder="Choose a region" required>
        {options}
      </Select>,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select).toHaveValue("");
    const placeholder = select.options[0] as HTMLOptionElement;
    expect(placeholder).toHaveTextContent("Choose a region");
    expect(placeholder.selected).toBe(true);
    expect(placeholder).toBeDisabled();
    expect(select.checkValidity()).toBe(false);
  });

  it("selects the first real option when there is no placeholder (positive control)", () => {
    render(<Select aria-label="Region">{options}</Select>);
    expect(screen.getByRole("combobox")).toHaveValue("eu");
  });

  it("keeps a given defaultValue over the placeholder", () => {
    render(
      <Select aria-label="Region" placeholder="Choose" defaultValue="us">
        {options}
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveValue("us");
  });

  it("read-only refuses the opening keys and mouse, keeps Tab, and says so", () => {
    render(
      <Select aria-label="Region" readOnly defaultValue="eu">
        {options}
      </Select>,
    );
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-readonly", "true");
    expect(fireEvent.mouseDown(select)).toBe(false);
    expect(fireEvent.keyDown(select, { key: "ArrowDown" })).toBe(false);
    expect(fireEvent.keyDown(select, { key: " " })).toBe(false);
    expect(fireEvent.keyDown(select, { key: "Tab" })).toBe(true);
  });

  it("does not block keys when editable (positive control)", () => {
    render(<Select aria-label="Region">{options}</Select>);
    expect(fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })).toBe(true);
  });

  it("reports invalid and disabled", () => {
    render(
      <>
        <Select aria-label="Bad" invalid>
          {options}
        </Select>
        <Select aria-label="Off" disabled>
          {options}
        </Select>
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Bad" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: "Off" })).toBeDisabled();
  });
});
