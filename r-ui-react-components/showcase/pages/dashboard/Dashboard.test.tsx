import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../src/components/overlays";
import { Dashboard } from "../Dashboard";

const START = "#/overview";

function renderDashboard(anchor: string | null) {
  return render(
    <ToastProvider>
      <Dashboard anchor={anchor} />
    </ToastProvider>,
  );
}

/** The services rows on the table's page, by name. */
const serviceRows = () =>
  [...document.querySelectorAll<HTMLElement>("[data-dashboard-services] tbody tr[data-table-row] [data-service]")].map(
    (el) => el.dataset.service,
  );

beforeEach(() => {
  window.history.replaceState(null, "", START);
  vi.spyOn(console, "error");
});
afterEach(() => vi.restoreAllMocks());

describe("the Dashboard page", () => {
  it("renders every card without tripping a boundary, and leaves the URL alone on the default view", () => {
    renderDashboard(null);
    expect(document.querySelectorAll("[data-dashboard-error]")).toHaveLength(0);
    expect(console.error).toHaveBeenCalledTimes(0);
    // Ten to a page out of fourteen services.
    expect(serviceRows()).toHaveLength(10);
    const bar = screen.getByRole("search", { name: "Filters" });
    expect(bar.querySelector("[data-filter-chip='time']")).toHaveTextContent("Last 7 days");
    expect(window.location.hash).toBe(START);
  });

  it("opens on the view its anchor holds", () => {
    renderDashboard("status=critical&env=staging&time=");
    expect(serviceRows()).toEqual(["checkout"]);
    expect(document.querySelector("[data-filter-results]")).toHaveTextContent("1 service");
    expect(screen.getByRole("radio", { name: "Staging" })).toHaveAttribute("aria-checked", "true");
    // An empty time filter means all the retained data (a missing one, the default window).
    expect(screen.getByText("Last 90 days, daily")).toBeInTheDocument();
  });

  it("writes a filter change into the hash, and an empty search state offers the way out", () => {
    renderDashboard(null);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search services" }), { target: { value: "zzz" } });
    expect(window.location.hash).toBe(`#/dashboard/${encodeURIComponent("q=zzz")}`);
    expect(serviceRows()).toEqual([]);
    expect(screen.getByText("No services match “zzz”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(serviceRows()).toHaveLength(10);
    // Back to the default view: the anchor empties again.
    expect(window.location.hash).toBe("#/dashboard");
  });

  it("adopts a hash that moves from outside", () => {
    const { rerender } = renderDashboard(null);
    rerender(
      <ToastProvider>
        <Dashboard anchor="q=pay" />
      </ToastProvider>,
    );
    expect(serviceRows().sort()).toEqual(["billing", "checkout", "ledger"]);
  });

  it("shows a deploy's rollout as progress in the service's detail row", () => {
    renderDashboard("q=search");
    fireEvent.click(screen.getByRole("button", { name: "Details for search" }));
    const detail = document.querySelector("[data-dashboard-detail='search']");
    expect(detail).not.toBeNull();
    const rollout = within(detail as HTMLElement).getByRole("progressbar", { name: "Rollout of 4f2a91c" });
    expect(rollout).toHaveAttribute("aria-valuenow", "3");
    expect(rollout).toHaveAttribute("aria-valuemax", "5");
  });
});
