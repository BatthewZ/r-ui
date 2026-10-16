import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DataTableFeaturesSection from "../sections/data/DataTableFeatures";
import DataTableServerSection from "../sections/data/DataTableServer";

describe("the DataTable features demos", () => {
  it("render every table, the all-features one with its tools", () => {
    render(<DataTableFeaturesSection />);
    for (const id of ["dt-all", "dt-all-rtl", "dt-all-compact", "dt-expand", "dt-columns", "dt-resize", "dt-bulk", "dt-filters", "dt-pages", "dt-sticky"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    const all = within(screen.getByTestId("dt-all"));
    expect(all.getByRole("button", { name: "Columns" })).toBeInTheDocument();
    expect(all.getByRole("textbox", { name: "Filter Service" })).toBeInTheDocument();
    expect(all.getByRole("combobox", { name: "Rows per page" })).toHaveValue("10");
    expect(all.getByText("1–10 of 48")).toBeInTheDocument();
  });
});

describe("the DataTable server demo's simulated latency", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const table = () => screen.getByRole("table", { name: "Services (server)" });
  const settle = () => act(() => vi.advanceTimersByTime(700));

  it("is busy until the first page lands, then shows exactly that page of the total", () => {
    render(<DataTableServerSection />);
    expect(table()).toHaveAttribute("aria-busy", "true");
    settle();
    expect(table()).not.toHaveAttribute("aria-busy");
    expect(screen.getByText("1–10 of 240")).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(2 + 10);
  });

  it("asks again for a page, and drops an answer a newer request replaced", () => {
    render(<DataTableServerSection />);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(table()).toHaveAttribute("aria-busy", "true");
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    // When page 2's answer would have landed: dropped, still waiting for page 3.
    act(() => vi.advanceTimersByTime(400));
    expect(table()).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("11–20 of 240")).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("21–30 of 240")).toBeInTheDocument();
    expect(screen.getByText(/page 3 of size 10/)).toBeInTheDocument();
  });

  it("shows the error state while the server fails, and rows again once it answers", () => {
    render(<DataTableServerSection />);
    settle();
    fireEvent.click(screen.getByRole("switch", { name: "The server fails every request" }));
    settle();
    expect(screen.getByRole("alert")).toHaveTextContent("The services API did not answer");
    fireEvent.click(screen.getByRole("switch", { name: "The server fails every request" }));
    settle();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("1–10 of 240")).toBeInTheDocument();
  });
});
