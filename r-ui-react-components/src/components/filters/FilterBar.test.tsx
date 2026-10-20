import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { stubDialog } from "../overlays/overlay-stubs.test.helpers";

import { FilterBar, type FilterBarProps, RESULT_ANNOUNCE_DELAY_MS } from "./FilterBar";
import type { FilterDefinition, FilterValues } from "./filter-model";

const FILTERS: FilterDefinition[] = [
  {
    id: "region",
    label: "Region",
    kind: "multi",
    options: [
      { value: "eu", label: "EU" },
      { value: "us", label: "US" },
    ],
  },
  { id: "team", label: "Team", kind: "select", options: [{ value: "payments", label: "Payments" }, { value: "growth", label: "Growth" }] },
  {
    id: "status",
    label: "Status",
    kind: "toggle",
    options: [
      { value: "up", label: "Healthy" },
      { value: "down", label: "Down" },
    ],
  },
  { id: "p95", label: "p95", kind: "range", min: 0, max: 2000, step: 50, formatOptions: { style: "unit", unit: "millisecond" } },
  { id: "time", label: "Time", kind: "dateRange", withTime: true },
  { id: "q", label: "Search", kind: "search" },
];

const APPLIED: FilterValues = {
  region: ["eu", "us"],
  p95: [300, 2000],
  time: { start: new Date(2026, 9, 9), end: new Date(2026, 9, 16), preset: "last-7-days" },
};

function Bar(props: Partial<FilterBarProps>) {
  return <FilterBar filters={FILTERS} collapse="never" locale="en-US" {...props} />;
}

const chipTexts = () =>
  within(screen.getByRole("list", { name: "Applied filters" }))
    .queryAllByRole("listitem")
    .map((li) => li.textContent);

/** The bar's own status (the controls have announcers of their own). */
function resultsStatus() {
  const results = screen.getByRole("search").querySelector<HTMLElement>("[data-filter-results]");
  if (!results) throw new Error("no result count rendered");
  return within(results).getByRole("status");
}

let dialog: ReturnType<typeof stubDialog>;
beforeEach(() => {
  dialog = stubDialog();
});
afterEach(() => {
  dialog.restore();
  vi.useRealTimers();
});

describe("FilterBar: chips", () => {
  it("summarise each applied filter in a named list, in definition order", () => {
    render(<Bar defaultValue={APPLIED} />);
    expect(screen.getByRole("search", { name: "Filters" })).toBeInTheDocument();
    expect(chipTexts()).toEqual(["Region: EU, US", "p95 ≥ 300 ms", "Last 7 days"]);
    expect(screen.getByRole("button", { name: "Remove filter Region: EU, US" })).toBeInTheDocument();
  });

  it("appear as the controls apply filters, and the value holds only applied filters", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Bar onValueChange={onValueChange} />);
    expect(screen.queryByRole("list", { name: "Applied filters" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Down" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith({ status: ["down"] });
    expect(chipTexts()).toEqual(["Status: Down"]);

    await user.selectOptions(screen.getByLabelText("Team"), "payments");
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "checkout");
    expect(chipTexts()).toEqual(["Team: Payments", "Status: Down", "Search: “checkout”"]);
    expect(onValueChange).toHaveBeenLastCalledWith({ status: ["down"], team: "payments", q: "checkout" });

    // Un-pressing the last toggle removes the filter, not just its value.
    await user.click(screen.getByRole("button", { name: "Down" }));
    expect(onValueChange).toHaveBeenLastCalledWith({ team: "payments", q: "checkout" });
  });

  it("remove their filter and reset its control, focus moving to the chip that took the place, then the one before, then the first control", async () => {
    const user = userEvent.setup();
    render(<Bar defaultValue={{ team: "growth", status: ["up"], q: "auth" }} />);
    expect(chipTexts()).toEqual(["Team: Growth", "Status: Healthy", "Search: “auth”"]);

    await user.click(screen.getByRole("button", { name: "Remove filter Team: Growth" }));
    expect(chipTexts()).toEqual(["Status: Healthy", "Search: “auth”"]);
    expect(screen.getByLabelText("Team")).toHaveValue("");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove filter Status: Healthy" }));

    await user.click(screen.getByRole("button", { name: "Remove filter Search: “auth”" }));
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove filter Status: Healthy" }));

    // Backspace on a remove button removes too; with no chip left, focus starts the bar again.
    await user.keyboard("{Backspace}");
    expect(screen.queryByRole("list", { name: "Applied filters" })).toBeNull();
    expect(screen.getByRole("button", { name: "Healthy" })).toHaveAttribute("aria-pressed", "false");
    const firstControl = within(screen.getByRole("search")).getAllByRole("combobox")[0];
    expect(firstControl).toHaveAccessibleName("Region");
    expect(document.activeElement).toBe(firstControl);
  });

  it("Clear all empties every filter the bar owns, keeps other keys, and focuses the first control", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Bar defaultValue={{ ...APPLIED, name: "a column's own filter" }} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith({ name: "a column's own filter" });
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    expect(screen.getByRole("group", { name: "p95" })).toBeInTheDocument();
    expect(document.activeElement).toHaveAccessibleName("Region");
  });

  it("keep a disabled filter's chip, unremovable, through Clear all", async () => {
    const user = userEvent.setup();
    const filters = FILTERS.map((f) => (f.id === "region" ? { ...f, disabled: true } : f));
    render(<Bar filters={filters} defaultValue={{ region: ["eu"], q: "x" }} />);
    expect(screen.getByRole("button", { name: "Remove filter Region: EU" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(chipTexts()).toEqual(["Region: EU"]);
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("follow a controlled value, and stay when the parent refuses the removal", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Bar value={{ q: "a" }} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Remove filter Search: “a”" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith({});
    expect(chipTexts()).toEqual(["Search: “a”"]);
    rerender(<Bar value={{ team: "payments" }} onValueChange={onValueChange} />);
    expect(chipTexts()).toEqual(["Team: Payments"]);
  });
});

describe("FilterBar: result count", () => {
  it("shows the count at once and announces it politely once it has settled", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Bar resultCount={128} />);
    const status = resultsStatus();
    expect(status).toHaveTextContent("128 results");
    rerender(<Bar resultCount={12} />);
    expect(screen.getByText("12 results")).toBeInTheDocument();
    expect(status).toHaveTextContent("128 results");
    act(() => vi.advanceTimersByTime(RESULT_ANNOUNCE_DELAY_MS - 50));
    rerender(<Bar resultCount={1} />);
    act(() => vi.advanceTimersByTime(RESULT_ANNOUNCE_DELAY_MS - 50));
    expect(status).toHaveTextContent("128 results");
    act(() => vi.advanceTimersByTime(50));
    expect(status).toHaveTextContent(/^1 result$/);
  });

  it("says it is updating while loading, busy so nothing is read meanwhile", () => {
    render(<Bar resultCount={40} loading />);
    expect(screen.getByText("Updating results…")).toBeInTheDocument();
    expect(resultsStatus().closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });
});

describe("FilterBar: folded", () => {
  it("is a 'Filters (n)' button whose drawer holds the same controls on the same value", async () => {
    const user = userEvent.setup();
    function Folded() {
      const [value, setValue] = useState<FilterValues>({ region: ["eu"] });
      return <FilterBar filters={FILTERS} collapse="always" locale="en-US" value={value} onValueChange={setValue} resultCount={3} />;
    }
    render(<Folded />);
    expect(screen.queryByLabelText("Team")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Filters (1)" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);

    const drawer = screen.getByRole("dialog", { name: "Filters" });
    for (const label of ["Region", "Team", "Search"]) expect(within(drawer).getByLabelText(label)).toBeInTheDocument();
    expect(within(drawer).getByRole("group", { name: "p95" })).toBeInTheDocument();
    expect(within(drawer).getByRole("group", { name: "Status" })).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: "Down" }));
    expect(chipTexts()).toEqual(["Region: EU", "Status: Down"]);
    expect(trigger).toHaveTextContent("Filters (2)");

    // Clear all inside the drawer starts its controls again.
    await user.click(within(drawer).getByRole("button", { name: "Clear all" }));
    expect(trigger).toHaveTextContent(/^Filters$/);
    expect(document.activeElement).toBe(within(drawer).getByLabelText("Region"));

    await user.click(within(drawer).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts focus on the Filters button when the last chip goes", async () => {
    const user = userEvent.setup();
    render(<Bar collapse="always" defaultValue={{ q: "x" }} />);
    await user.click(screen.getByRole("button", { name: "Remove filter Search: “x”" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filters" }));
  });

  it("in auto mode renders both, each hidden by the bar's own container width", () => {
    render(<Bar collapse="auto" />);
    const search = screen.getByRole("search");
    expect(search).toHaveClass("@container");
    expect(screen.getByRole("button", { name: "Filters" })).toHaveClass("@2xl:hidden");
    expect(screen.getByLabelText("Team").closest("[data-filter]")).toHaveClass("@max-2xl:hidden");
  });
});

describe("FilterBar: words and states", () => {
  it("takes its words from the LocaleProvider, and the instance's over them", () => {
    render(
      <LocaleProvider labels={{ FilterBar: { clearAll: "Alle löschen", applied: "Aktive Filter" } }}>
        <Bar defaultValue={{ q: "x" }} labels={{ remove: (chip) => `${chip} entfernen` }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Alle löschen" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Aktive Filter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search: “x” entfernen" })).toBeInTheDocument();
  });

  it("disables every control, chip and Clear all when disabled", () => {
    render(<Bar disabled defaultValue={{ q: "x", status: ["up"] }} />);
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeDisabled();
    expect(screen.getByLabelText("Team")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Healthy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove filter Search: “x”" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("renders a custom filter's control inside its labelled field and writes its chip with its format", async () => {
    const user = userEvent.setup();
    const custom: FilterDefinition = {
      id: "owner",
      label: "Owner",
      kind: "custom",
      format: (v) => `Owner is ${String(v)}`,
      render: ({ value, onValueChange, id }) => (
        <input id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onValueChange(e.target.value)} />
      ),
    };
    render(<FilterBar filters={[custom]} collapse="never" />);
    await user.type(screen.getByLabelText("Owner"), "ana");
    expect(chipTexts()).toEqual(["Owner is ana"]);
  });
  it("a time range shows its placeholder while unapplied, and resolves presets against the bar's `now`", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // The data's clock (March) is behind the device's; `max` ends there, so only `now` keeps the presets usable.
    const now = new Date(2026, 2, 20, 12, 0);
    const time: FilterDefinition = { id: "time", label: "Time", kind: "dateRange", withTime: true, placeholder: "All time", max: now };
    render(<FilterBar filters={[time]} collapse="never" locale="en-US" now={now} onValueChange={onValueChange} />);
    const trigger = screen.getByRole("button", { name: /^Time/ });
    expect(trigger).toHaveTextContent("All time");
    // It reads like the bar's other fields: a field's box, not a Button.
    expect(trigger).toHaveClass("r-form-frame", "text-start");
    expect(trigger.lastElementChild).toHaveClass("lucide-calendar-range");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Last 24 hours" }));
    const value = onValueChange.mock.lastCall![0] as FilterValues;
    expect(value.time).toEqual({ start: new Date(2026, 2, 19, 12, 0), end: now, preset: "last-24-hours" });
  });
});
