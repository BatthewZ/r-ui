import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarDays } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { SegmentedControl } from "./SegmentedControl";

function Range(props: Partial<React.ComponentProps<typeof SegmentedControl>>) {
  return (
    <SegmentedControl aria-label="Range" defaultValue="week" {...props}>
      <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
      <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
      <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
    </SegmentedControl>
  );
}

describe("SegmentedControl", () => {
  it("is a named radiogroup whose segments are radios named by their text", () => {
    render(<Range />);
    expect(screen.getByRole("radiogroup", { name: "Range" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["day", "week", "month"]);
    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
    expect(screen.getByText("Week").closest("label")).toHaveAttribute("data-selected");
    expect(screen.getByText("Day").closest("label")).not.toHaveAttribute("data-selected");
  });

  it("has one tab stop, the selected segment, and arrows move the selection", async () => {
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">before</button>
        <Range onValueChange={onValueChange} />
        <button type="button">after</button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "before" }));
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Week" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Month" })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("month");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Day" })).toBeChecked();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("selects on click and is controlled", async () => {
    const onValueChange = vi.fn();
    render(<Range value="day" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByText("Month"));
    expect(onValueChange).toHaveBeenCalledWith("month");
    expect(screen.getByRole("radio", { name: "Day" })).toBeChecked();
  });

  it("names an icon-only segment by aria-label", () => {
    render(
      <SegmentedControl aria-label="View" defaultValue="cal">
        <SegmentedControl.Item value="cal" icon={<CalendarDays />} aria-label="Calendar" />
        <SegmentedControl.Item value="list">List</SegmentedControl.Item>
      </SegmentedControl>,
    );
    expect(screen.getByRole("radio", { name: "Calendar" })).toBeChecked();
  });

  it("skips a disabled segment and refuses changes when read-only", async () => {
    const onValueChange = vi.fn();
    render(
      <>
        <SegmentedControl aria-label="A" defaultValue="x" onValueChange={onValueChange}>
          <SegmentedControl.Item value="x">X</SegmentedControl.Item>
          <SegmentedControl.Item value="y" disabled>
            Y
          </SegmentedControl.Item>
        </SegmentedControl>
        <Range aria-label="B" readOnly onValueChange={onValueChange} />
      </>,
    );
    expect(screen.getByRole("radio", { name: "Y" })).toBeDisabled();
    await userEvent.click(screen.getByText("Y"));
    expect(screen.getByRole("radio", { name: "X" })).toBeChecked();

    expect(screen.getByRole("radiogroup", { name: "B" })).toHaveAttribute("aria-readonly", "true");
    await userEvent.click(screen.getByText("Day"));
    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(0);
  });

  it("takes its name from a Field label", () => {
    render(
      <Field>
        <Field.Label>Granularity</Field.Label>
        <Range aria-label={undefined} />
      </Field>,
    );
    expect(screen.getByRole("radiogroup", { name: "Granularity" })).toBeInTheDocument();
  });
});
