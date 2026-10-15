import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataTableColumn, RowKey } from "./data-table-model";
import { VirtualizedTable } from "./VirtualizedTable";

interface Item {
  id: number;
  label: string;
}

const ROWS: Item[] = Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `item ${i}` }));
const COLUMNS: DataTableColumn<Item>[] = [
  { id: "label", header: "Label", value: (r) => r.label },
  { id: "id", header: "Id", value: (r) => r.id, numeric: true, width: "20%" },
];

// jsdom resolves custom properties from stylesheets and inheritance (no layout,
// no @property, no ResizeObserver), which is enough to drive the measurement
// path: the hook reads `--ROW-H` from the scroll area and re-reads it whenever
// its probe resizes. jsdom has no ResizeObserver, so a stub records what the
// hook observes; `resize()` is what the browser does when the probe's
// `height: var(--ROW-H)` resolves differently.
let sheet: HTMLStyleElement;
let observed: { target: Element; callback: () => void }[];
const resize = () => act(() => observed.forEach((o) => o.callback()));
beforeEach(() => {
  sheet = document.createElement("style");
  sheet.textContent = `
    :root { --ROW-H: 40px; }
    [data-density="compact"] { --ROW-H: 30px; }
    :root[data-input="coarse"] { --ROW-H: 44px; }
  `;
  document.head.append(sheet);
  observed = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Element) {
        observed.push({ target, callback: this.callback });
      }
      unobserve() {}
      disconnect() {
        observed = observed.filter((o) => o.callback !== this.callback);
      }
    },
  );
});
afterEach(() => {
  sheet.remove();
  document.documentElement.removeAttribute("data-density");
  document.documentElement.removeAttribute("data-input");
  vi.unstubAllGlobals();
});

const bodyRows = () => screen.getAllByRole("row").filter((r) => r.hasAttribute("aria-rowindex") && r.getAttribute("aria-rowindex") !== "1");
/** The bottom spacer row (aria-hidden, after the last mounted row). */
const bottomSpacer = (table: HTMLElement) => {
  const rows = table.querySelectorAll("tbody > tr");
  return rows[rows.length - 1] as HTMLElement;
};

describe("VirtualizedTable", () => {
  it("mounts only a window of 10,000 rows and keeps the row count and indices for AT", () => {
    render(<VirtualizedTable aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} visibleRows={10} overscan={4} />);
    const table = screen.getByRole("table", { name: "Items" });
    expect(table).toHaveAttribute("aria-rowcount", "10001");
    expect(table).toHaveClass("table-fixed");
    const rows = bodyRows();
    // 10 visible + 2 × 4 overscan at most, from the top.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(18);
    expect(rows[0]).toHaveAttribute("aria-rowindex", "2");
    expect(screen.queryByText("item 9999")).toBeNull();
  });

  it("sizes the spacer from the measured --ROW-H and re-measures when density changes", () => {
    render(<VirtualizedTable aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} visibleRows={10} overscan={0} />);
    const table = screen.getByRole("table");
    const mounted = bodyRows().length;
    expect(bottomSpacer(table).style.blockSize).toBe(`${(10_000 - mounted) * 40}px`);

    document.documentElement.setAttribute("data-density", "compact");
    resize();
    expect(bottomSpacer(table).style.blockSize).toBe(`${(10_000 - bodyRows().length) * 30}px`);
  });

  it("watches a hidden, row-tall probe inside the scroll area, and removes it on unmount", () => {
    const { unmount } = render(
      <VirtualizedTable data-testid="v" aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} />,
    );
    const probe = screen.getByTestId("v").querySelector("[data-row-height-probe]");
    expect(probe).not.toBeNull();
    expect(probe).toHaveAttribute("aria-hidden", "true");
    expect(probe).toHaveClass("h-row", "absolute", "invisible");
    // Exactly once (useVirtualRows observes the scroll area itself as well).
    expect(observed.filter((o) => o.target === probe)).toHaveLength(1);
    unmount();
    expect(probe!.isConnected).toBe(false);
    expect(observed.filter((o) => o.target === probe)).toHaveLength(0);
  });

  it("re-measures after a stylesheet change that moves no attribute at all", () => {
    render(<VirtualizedTable aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} overscan={0} />);
    const table = screen.getByRole("table");
    // A theme loaded late, or a consumer retuning --ROW-H-COMFORTABLE.
    sheet.textContent += ":root { --ROW-H: 36px; }";
    resize();
    expect(bottomSpacer(table).style.blockSize).toBe(`${(10_000 - bodyRows().length) * 36}px`);
  });

  it("a plain DataTable mounts no probe", async () => {
    const { DataTable } = await import("./DataTable");
    render(<DataTable data-testid="d" aria-label="Items" columns={COLUMNS} rows={ROWS.slice(0, 3)} getRowKey={(r) => r.id} />);
    expect(screen.getByRole("table", { name: "Items" })).toBeInTheDocument();
    expect(document.querySelector("[data-row-height-probe]")).toBeNull();
  });

  it("select-all spans the whole dataset, not the mounted window", async () => {
    const user = userEvent.setup();
    const onSelectedKeysChange = vi.fn();
    render(
      <VirtualizedTable
        aria-label="Items"
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={(r) => r.id}
        selectable
        onSelectedKeysChange={onSelectedKeysChange}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(onSelectedKeysChange).toHaveBeenCalledTimes(1);
    expect((onSelectedKeysChange.mock.lastCall?.[0] as Set<RowKey>).size).toBe(10_000);
  });

  it("sorts the whole dataset before windowing", async () => {
    const user = userEvent.setup();
    render(<VirtualizedTable aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} />);
    await user.click(screen.getByRole("button", { name: "Id" }));
    expect(bodyRows()[0]).toHaveTextContent("item 9999");
  });

  it("sizes the viewport in rows of --ROW-H, and a caller's height class replaces it", () => {
    const { rerender } = render(
      <VirtualizedTable data-testid="v" aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} visibleRows={7} />,
    );
    const root = screen.getByTestId("v");
    expect(root).toHaveClass("h-[calc(var(--ROW-H)*(var(--visible-rows)+1))]");
    expect(root.style.getPropertyValue("--visible-rows")).toBe("7");
    rerender(
      <VirtualizedTable data-testid="v" aria-label="Items" columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} className="h-full" />,
    );
    expect(root).toHaveClass("h-full");
    expect(root).not.toHaveClass("h-[calc(var(--ROW-H)*(var(--visible-rows)+1))]");
  });
});
