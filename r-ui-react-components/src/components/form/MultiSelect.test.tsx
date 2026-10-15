import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { MultiSelect } from "./MultiSelect";
import type { ComboboxOption } from "./selection-popup";

const REGIONS: ComboboxOption[] = [
  { value: "eu-west-1", label: "Europe (Ireland)", group: "Europe" },
  { value: "eu-central-1", label: "Europe (Frankfurt)", group: "Europe" },
  { value: "us-east-1", label: "US East", group: "Americas" },
  { value: "sa-east-1", label: "São Paulo", group: "Americas", disabled: true },
];

function Regions(props: Partial<React.ComponentProps<typeof MultiSelect>>) {
  return (
    <Field required>
      <Field.Label>Regions</Field.Label>
      <MultiSelect options={REGIONS} {...props} />
    </Field>
  );
}

const input = () => screen.getByRole("combobox", { name: "Regions" });
const chips = () => screen.queryByRole("list", { name: "Selected" });
const chipNames = () => (chips() ? within(chips()!).getAllByRole("listitem").map((li) => li.textContent) : []);

describe("MultiSelect", () => {
  it("toggles options with Enter, keeps the list open, clears the search and shows chips", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Regions onValueChange={onValueChange} />);
    await user.type(input(), "frank{Enter}");
    expect(onValueChange.mock.calls).toEqual([[["eu-central-1"]]]);
    expect(input()).toHaveValue("");
    const listbox = screen.getByRole("listbox", { name: "Regions" });
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    expect(chipNames()).toEqual(["Europe (Frankfurt)"]);
    expect(screen.getByRole("option", { name: "Europe (Frankfurt)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "US East" })).toHaveAttribute("aria-selected", "false");
    // A press toggles too, and toggles off.
    await user.click(screen.getByRole("option", { name: "US East" }));
    await user.click(screen.getByRole("option", { name: "Europe (Frankfurt)" }));
    expect(onValueChange.mock.calls.at(-1)).toEqual([["us-east-1"]]);
    expect(chipNames()).toEqual(["US East"]);
    expect(input()).toHaveFocus();
    expect(screen.getAllByRole("status").map((s) => s.textContent).join(" ")).toContain("Europe (Frankfurt) removed. 1 selected.");
  });

  it("Backspace in an empty search removes the last chip, and only then", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Regions defaultValue={["eu-west-1", "us-east-1"]} onValueChange={onValueChange} />);
    await user.type(input(), "x{Backspace}");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard("{Backspace}");
    expect(onValueChange.mock.calls).toEqual([[["eu-west-1"]]]);
    expect(chipNames()).toEqual(["Europe (Ireland)"]);
  });

  it("chips are keyboard reachable: Tab to a remove button, Enter removes, focus moves on", async () => {
    const user = userEvent.setup();
    render(<Regions defaultValue={["eu-west-1", "us-east-1"]} />);
    await user.tab();
    const first = screen.getByRole("button", { name: "Remove Europe (Ireland)" });
    expect(first).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(chipNames()).toEqual(["US East"]);
    expect(screen.getByRole("button", { name: "Remove US East" })).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(chips()).toBeNull();
    expect(input()).toHaveFocus();
  });

  it("ArrowLeft at the start of the search moves onto the last chip, ArrowRight comes back", async () => {
    const user = userEvent.setup();
    render(<Regions defaultValue={["eu-west-1", "us-east-1"]} />);
    await user.click(input());
    await user.keyboard("{Escape}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Remove US East" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Remove Europe (Ireland)" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(input()).toHaveFocus();
  });

  it("max disables the rest, says why, and counts the selection rather than the rows", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Regions max={2} defaultValue={["eu-west-1"]} onValueChange={onValueChange} />);
    await user.type(input(), "us{Enter}");
    expect(onValueChange.mock.calls).toEqual([[["eu-west-1", "us-east-1"]]]);
    // The first pick is filtered out of view; the cap must still count it.
    await user.type(input(), "frank");
    const frankfurt = screen.getByRole("option", { name: "Europe (Frankfurt)" });
    expect(frankfurt).toHaveAttribute("aria-disabled", "true");
    await user.click(frankfurt);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("listbox").parentElement).toHaveTextContent("Up to 2 can be selected.");
  });

  it("select all takes every listed enabled option, then clears them", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Regions selectAll onValueChange={onValueChange} />);
    await user.type(input(), "europe");
    const all = screen.getByRole("option", { name: "Select all" });
    await user.click(all);
    expect(onValueChange.mock.calls).toEqual([[["eu-west-1", "eu-central-1"]]]);
    await user.type(input(), "europe");
    expect(screen.getByRole("option", { name: "Select all" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Select all" }));
    expect(onValueChange.mock.calls.at(-1)).toEqual([[]]);
  });

  it("never submits from an open list; submits one hidden input per value", async () => {
    const user = userEvent.setup();
    let submitted: FormData | null = null;
    const onSubmit = vi.fn((event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitted = new FormData(event.currentTarget);
    });
    render(
      <form onSubmit={onSubmit}>
        <Regions name="regions" />
        <button type="submit">Save</button>
      </form>,
    );
    await user.type(input(), "ireland{Enter}");
    await user.type(input(), "us east{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Escape}{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitted!.getAll("regions")).toEqual(["eu-west-1", "us-east-1"]);
  });

  it("is required only while nothing is chosen, and says so to assistive tech throughout", async () => {
    const user = userEvent.setup();
    render(<Regions />);
    expect(input()).toBeRequired();
    await user.type(input(), "us{Enter}");
    expect(input()).not.toHaveAttribute("required");
    expect(input()).toHaveAttribute("aria-required", "true");
  });

  it("folds two or more chips into a summary for a narrow field (both rendered, CSS picks)", () => {
    const { rerender } = render(<Regions value={["eu-west-1"]} />);
    expect(screen.queryByText("1 selected")).toBeNull();
    expect(chips()).not.toHaveClass("@max-column-md:hidden");
    rerender(<Regions value={["eu-west-1", "us-east-1"]} />);
    expect(screen.getByText("2 selected")).toHaveClass("hidden", "@max-column-md:inline-flex");
    expect(chips()).toHaveClass("@max-column-md:hidden");
  });

  it("a narrow field's summary is the way to its hidden chips: ArrowLeft lands on it, a press unfolds them", async () => {
    const user = userEvent.setup();
    // Stands in for the container query: the folded chip list has no box.
    const narrow = document.createElement("style");
    narrow.textContent = '[class~="@max-column-md:hidden"] { display: none; }';
    document.head.append(narrow);
    try {
      render(
        <>
          <Regions defaultValue={["eu-west-1", "eu-central-1", "us-east-1"]} />
          <button type="button">After</button>
        </>,
      );
      await user.click(input());
      await user.keyboard("{Escape}{ArrowLeft}");
      const summary = screen.getByRole("button", { name: "3 selected" });
      expect(summary).toHaveFocus();
      expect(summary).toHaveAttribute("aria-expanded", "false");
      const list = document.getElementById(summary.getAttribute("aria-controls")!);
      expect(list).toHaveAttribute("aria-label", "Selected");
      expect(list).toHaveClass("@max-column-md:hidden");
      await user.keyboard("{ArrowRight}");
      expect(input()).toHaveFocus();

      await user.keyboard("{ArrowLeft}{Enter}");
      expect(list).not.toHaveClass("@max-column-md:hidden");
      expect(screen.queryByRole("button", { name: "3 selected" })).toBeNull();
      expect(screen.getByRole("button", { name: "Remove Europe (Ireland)" })).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(chipNames()).toEqual(["Europe (Frankfurt)", "US East"]);

      // Leaving the control folds them again.
      await user.click(screen.getByRole("button", { name: "After" }));
      expect(screen.getByRole("button", { name: "2 selected" })).toBeInTheDocument();
      expect(list).toHaveClass("@max-column-md:hidden");
    } finally {
      narrow.remove();
    }
  });

  it("a load error lists no options and no select-all: the cursor points at nothing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Regions selectAll loadError="Could not load regions." onValueChange={onValueChange} />);
    await user.type(input(), "e");
    expect(screen.getByRole("listbox").parentElement).toHaveTextContent("Could not load regions.");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input()).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(input()).not.toHaveAttribute("aria-activedescendant");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("disabled: no removal, no list", async () => {
    const user = userEvent.setup();
    render(<Regions disabled defaultValue={["eu-west-1"]} />);
    expect(screen.getByRole("button", { name: "Remove Europe (Ireland)" })).toBeDisabled();
    await user.click(input());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
