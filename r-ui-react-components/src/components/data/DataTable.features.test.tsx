import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COLUMN_RESIZE_STEP,
  type DataTableColumn,
  type DataTableFilters,
  DEFAULT_COLUMN_MAX,
  DEFAULT_COLUMN_MIN,
  type RowKey,
} from "./data-table-model";
import { DataTable, type DataTableProps } from "./DataTable";
import { VirtualizedTable, type VirtualizedTableProps } from "./VirtualizedTable";

interface Svc {
  id: string;
  name: string;
  team: string;
  p95: number | null;
}

const ROWS: Svc[] = [
  { id: "a", name: "auth", team: "identity", p95: 41 },
  { id: "c", name: "checkout", team: "payments", p95: 640 },
  { id: "r", name: "récommendations", team: "ml", p95: null },
  { id: "s", name: "search", team: "discovery", p95: 212 },
  { id: "b", name: "billing", team: "payments", p95: 120 },
];

const COLUMNS: DataTableColumn<Svc>[] = [
  { id: "name", header: "Service", value: (s) => s.name, required: true, filter: { type: "text" } },
  {
    id: "team",
    header: "Team",
    value: (s) => s.team,
    filter: {
      type: "select",
      options: [
        { value: "payments", label: "Payments" },
        { value: "identity", label: "Identity" },
      ],
    },
  },
  { id: "p95", header: "p95 ms", value: (s) => s.p95, numeric: true },
];

const PLAIN: DataTableColumn<Svc>[] = COLUMNS.map(({ filter: _filter, ...c }) => c);

function renderTable(props: Partial<DataTableProps<Svc>> = {}) {
  return render(
    <DataTable aria-label="Services" columns={PLAIN} rows={ROWS} getRowKey={(s) => s.id} {...props} />,
  );
}

/** The data rows (rows with a row checkbox or a name cell), first cell text after the control columns. */
const bodyRows = () => within(screen.getAllByRole("rowgroup")[1] as HTMLElement).queryAllByRole("row");
const names = () =>
  bodyRows()
    .filter((r) => !r.hasAttribute("data-table-detail"))
    .map((r) => r.querySelector("td:not(:has(button, input))")?.textContent);
/** The data columns' headers (not the trailing tools cell, which holds the open menu). */
const headers = () =>
  screen
    .getAllByRole("columnheader")
    .filter((h) => h.hasAttribute("data-column-key"))
    .map((h) => h.textContent);

/**
 * jsdom lays nothing out. Header cells are drawn 200px wide, and the resize
 * probes resolve the default bounds and step to what a browser would give at
 * comfortable density, so the handle's arithmetic can be followed.
 */
function stubLayout({ th = 200 }: { th?: number } = {}) {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const probe = this instanceof HTMLElement ? this.dataset.lengthProbe : undefined;
    const width =
      probe === DEFAULT_COLUMN_MIN
        ? 64
        : probe === DEFAULT_COLUMN_MAX
          ? 480
          : probe === COLUMN_RESIZE_STEP
            ? 12
            : this.tagName === "TH"
              ? th
              : 0;
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataTable: expandable detail rows", () => {
  it("opens a detail row under its row from a disclosure button, spanning every column", async () => {
    const user = userEvent.setup();
    const renderDetail = vi.fn((s: Svc) => <p>Owned by {s.team}</p>);
    renderTable({ renderDetail, selectable: true, rowActions: () => <button type="button">More</button> });
    const toggle = screen.getByRole("button", { name: "Details for checkout" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toHaveAttribute("aria-controls");
    // Called for open rows only.
    expect(renderDetail).not.toHaveBeenCalled();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const detail = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toBe("Owned by payments");
    // Expand + checkbox + 3 columns + actions.
    expect(detail?.querySelector("td")).toHaveAttribute("colspan", "6");
    expect(detail?.querySelector("td")).toHaveClass("r-data-table-detail");
    // Directly under its own row.
    expect(detail?.previousElementSibling).toContainElement(toggle);
    expect(renderDetail).toHaveBeenCalledWith(ROWS[1]);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector("[data-table-detail]")).toBeNull();
  });

  it("is reachable and operable from the keyboard", async () => {
    const user = userEvent.setup();
    renderTable({ renderDetail: (s) => `Detail of ${s.name}` });
    await user.tab();
    expect(screen.getByRole("button", { name: "Service" })).toHaveFocus();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Details for auth" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Detail of auth")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.queryByText("Detail of auth")).toBeNull();
  });

  it("controlled: reports the toggle, opens only what the parent passes", async () => {
    const user = userEvent.setup();
    const onExpandedKeysChange = vi.fn();
    const { rerender } = renderTable({
      renderDetail: (s) => `Detail of ${s.name}`,
      expandedKeys: new Set<RowKey>(["s"]),
      onExpandedKeysChange,
    });
    expect(screen.getByText("Detail of search")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Details for auth" }));
    expect(onExpandedKeysChange).toHaveBeenCalledTimes(1);
    expect([...(onExpandedKeysChange.mock.calls[0]?.[0] as Set<RowKey>)].sort()).toEqual(["a", "s"]);
    expect(screen.queryByText("Detail of auth")).toBeNull();
    rerender(
      <DataTable
        aria-label="Services"
        columns={PLAIN}
        rows={ROWS}
        getRowKey={(s) => s.id}
        renderDetail={(s) => `Detail of ${s.name}`}
        expandedKeys={new Set<RowKey>(["a"])}
        onExpandedKeysChange={onExpandedKeysChange}
      />,
    );
    expect(screen.getByText("Detail of auth")).toBeInTheDocument();
    expect(screen.queryByText("Detail of search")).toBeNull();
  });
});

describe("DataTable: column visibility", () => {
  it("hides and shows columns from the columns menu; a required column cannot be hidden", async () => {
    const user = userEvent.setup();
    const onVisibleColumnsChange = vi.fn();
    renderTable({ columnsMenu: true, onVisibleColumnsChange });
    expect(headers()).toEqual(["Service", "Team", "p95 ms"]);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    const team = screen.getByRole("menuitemcheckbox", { name: "Team" });
    expect(team).toHaveAttribute("aria-checked", "true");
    const service = screen.getByRole("menuitemcheckbox", { name: "Service" });
    expect(service).toHaveAttribute("aria-disabled", "true");

    await user.click(team);
    expect(headers()).toEqual(["Service", "p95 ms"]);
    expect(screen.queryByRole("cell", { name: "payments" })).toBeNull();
    expect(onVisibleColumnsChange).toHaveBeenCalledTimes(1);
    expect([...(onVisibleColumnsChange.mock.calls[0]?.[0] as Set<string>)].sort()).toEqual(["name", "p95"]);

    await user.click(service);
    expect(headers()).toEqual(["Service", "p95 ms"]);
    expect(onVisibleColumnsChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Team" }));
    expect(headers()).toEqual(["Service", "Team", "p95 ms"]);
  });

  it("controlled: shows exactly the parent's set (plus required columns); the last shown column stays", async () => {
    const user = userEvent.setup();
    const only = new Set(["p95"]);
    render(
      <DataTable
        aria-label="Services"
        columns={PLAIN.map((c) => ({ ...c, required: false }))}
        rows={ROWS}
        getRowKey={(s) => s.id}
        columnsMenu
        visibleColumns={only}
      />,
    );
    expect(headers()).toEqual(["p95 ms"]);
    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "p95 ms" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Service" })).not.toHaveAttribute("aria-disabled");
  });
});

describe("DataTable: column resizing", () => {
  it("is a focusable vertical separator per header, valued in px between its bounds", () => {
    stubLayout();
    renderTable({ resizableColumns: true, columns: PLAIN.map((c) => (c.id === "team" ? { ...c, resizable: false } : c)) });
    const handles = screen.getAllByRole("separator");
    expect(handles.map((h) => h.getAttribute("aria-label"))).toEqual(["Resize Service", "Resize p95 ms"]);
    const handle = handles[0] as HTMLElement;
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(handle).toHaveAttribute("aria-valuenow", "200");
    expect(handle).toHaveAttribute("aria-valuemin", "64");
    expect(handle).toHaveAttribute("aria-valuemax", "480");
  });

  it("arrows step the width, Home and End jump to the bounds; the header takes the width", async () => {
    stubLayout();
    const user = userEvent.setup();
    const onColumnWidthsChange = vi.fn();
    renderTable({ resizableColumns: true, onColumnWidthsChange });
    const handle = screen.getByRole("separator", { name: "Resize Service" });
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 212 });
    expect(handle).toHaveAttribute("aria-valuenow", "212");
    const header = screen.getByRole("columnheader", { name: /Service/ });
    // Exact: a minimum too, or auto layout squeezes it back inside a table at its own width.
    expect(header.style.getPropertyValue("--col-w")).toBe("calc(212 * 1px)");
    expect(header).toHaveClass("w-(--col-w)", "min-w-(--col-w)", "max-w-(--col-w)");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "188");
    await user.keyboard("{Home}");
    expect(handle).toHaveAttribute("aria-valuenow", "64");
    await user.keyboard("{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "64");
    await user.keyboard("{End}");
    expect(handle).toHaveAttribute("aria-valuenow", "480");
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "480");
    expect(onColumnWidthsChange).toHaveBeenCalledTimes(5);

    // A double click gives the column its automatic width back.
    await user.dblClick(handle);
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({});
    expect(header.style.getPropertyValue("--col-w")).toBe("");
    // The automatic width keeps the column's min.
    expect(header.style.getPropertyValue("--col-min")).toBe(DEFAULT_COLUMN_MIN);
    expect(header).toHaveClass("min-w-(--col-min)");
  });

  it("mirrors the arrows right to left", async () => {
    stubLayout();
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <DataTable aria-label="Services" columns={PLAIN} rows={ROWS} getRowKey={(s) => s.id} resizableColumns />
      </div>,
    );
    const handle = screen.getByRole("separator", { name: "Resize Service" });
    handle.focus();
    await user.keyboard("{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "212");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "188");
  });

  it("controlled: the parent's widths are the widths", async () => {
    stubLayout();
    const user = userEvent.setup();
    const onColumnWidthsChange = vi.fn();
    renderTable({ resizableColumns: true, columnWidths: { p95: 150 }, onColumnWidthsChange });
    const handle = screen.getByRole("separator", { name: "Resize p95 ms" });
    expect(handle).toHaveAttribute("aria-valuenow", "150");
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(onColumnWidthsChange).toHaveBeenCalledExactlyOnceWith({ p95: 162 });
    expect(handle).toHaveAttribute("aria-valuenow", "150");
  });

  it("drags by pointer: the width follows the pointer, clamped to the bounds", () => {
    stubLayout();
    const onColumnWidthsChange = vi.fn();
    renderTable({ resizableColumns: true, onColumnWidthsChange });
    const handle = screen.getByRole("separator", { name: "Resize Service" });
    fireEvent.pointerDown(handle, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 340, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 240 });
    fireEvent.pointerMove(handle, { clientX: 0, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 64 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 64 });
  });
});

describe("DataTable: bulk actions", () => {
  it("shows a bar with the count and actions while rows are selected; Clear selection empties it and keeps focus", async () => {
    const user = userEvent.setup();
    const bulkActions = vi.fn((keys: ReadonlySet<RowKey>) => <button type="button">Restart {keys.size}</button>);
    renderTable({ selectable: true, bulkActions });
    const status = screen.getByRole("status");
    // Mounted, and empty, before anything is selected, so the first count is announced.
    expect(status).toHaveTextContent("");
    expect(screen.queryByRole("group", { name: "Selected rows" })).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Select auth" }));
    await user.click(screen.getByRole("checkbox", { name: "Select search" }));
    await user.click(screen.getByRole("checkbox", { name: "Select billing" }));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("3 selected");
    const bar = screen.getByRole("group", { name: "Selected rows" });
    expect(within(bar).getByRole("button", { name: "Restart 3" })).toBeInTheDocument();
    expect([...(bulkActions.mock.lastCall?.[0] ?? [])].sort()).toEqual(["a", "b", "s"]);

    await user.click(within(bar).getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("group", { name: "Selected rows" })).toBeNull();
    expect(status).toHaveTextContent("");
    expect(screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked)).toHaveLength(0);
    expect(screen.getByRole("checkbox", { name: "Select all rows" })).toHaveFocus();
  });

  it("is opt-in: a selectable table without bulkActions draws no bar", async () => {
    const user = userEvent.setup();
    renderTable({ selectable: true });
    await user.click(screen.getByRole("checkbox", { name: "Select auth" }));
    expect(screen.queryByRole("group", { name: "Selected rows" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("DataTable: column filters", () => {
  it("narrows rows by text (case and accents ignored) and by select, and clears all at once", async () => {
    const user = userEvent.setup();
    renderTable({ columns: COLUMNS });
    expect(names()).toHaveLength(5);
    const clear = screen.getByRole("button", { name: "Clear filters" });
    expect(clear).toHaveAttribute("aria-disabled", "true");

    await user.type(screen.getByRole("textbox", { name: "Filter Service" }), "RECO");
    expect(names()).toEqual(["récommendations"]);
    await user.clear(screen.getByRole("textbox", { name: "Filter Service" }));
    expect(names()).toHaveLength(5);

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter Team" }), "payments");
    expect(names()).toEqual(["checkout", "billing"]);
    await user.type(screen.getByRole("textbox", { name: "Filter Service" }), "bill");
    expect(names()).toEqual(["billing"]);

    expect(clear).not.toHaveAttribute("aria-disabled");
    await user.click(clear);
    expect(names()).toHaveLength(5);
    expect(screen.getByRole("textbox", { name: "Filter Service" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Filter Team" })).toHaveValue("");
    expect(clear).toHaveFocus();
  });

  it("matching nothing shows its own empty state with a way out", async () => {
    const user = userEvent.setup();
    renderTable({ columns: COLUMNS, empty: <p>Nothing deployed yet</p> });
    await user.type(screen.getByRole("textbox", { name: "Filter Service" }), "zzz");
    expect(screen.getByText("No rows match the filters")).toBeInTheDocument();
    expect(screen.queryByText("Nothing deployed yet")).toBeNull();
    await user.click(within(screen.getAllByRole("rowgroup")[1] as HTMLElement).getByRole("button", { name: "Clear filters" }));
    expect(names()).toHaveLength(5);
  });

  it("controlled, and manualFiltering leaves the rows to the server", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    function Server() {
      const [filters, setFilters] = useState<DataTableFilters>({});
      return (
        <DataTable
          aria-label="Services"
          columns={COLUMNS}
          rows={ROWS}
          getRowKey={(s) => s.id}
          manualFiltering
          filters={filters}
          onFiltersChange={(f) => {
            onFiltersChange(f);
            setFilters(f);
          }}
        />
      );
    }
    render(<Server />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter Team" }), "identity");
    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ team: "identity" });
    expect(screen.getByRole("combobox", { name: "Filter Team" })).toHaveValue("identity");
    expect(names()).toHaveLength(5);
  });

  it("renders a custom filter control with its name and value", async () => {
    const user = userEvent.setup();
    const columns: DataTableColumn<Svc>[] = [
      ...PLAIN.slice(0, 2),
      {
        ...(PLAIN[2] as DataTableColumn<Svc>),
        filter: {
          type: "custom",
          match: (row, value) => (row.p95 ?? 0) >= Number(value),
          render: ({ value, onValueChange, label }) => (
            <button type="button" aria-label={label} aria-pressed={value === 200} onClick={() => onValueChange(value === 200 ? undefined : 200)}>
              Slow
            </button>
          ),
        },
      },
    ];
    renderTable({ columns });
    await user.click(screen.getByRole("button", { name: "Filter p95 ms" }));
    expect(names()).toEqual(["checkout", "search"]);
    expect(screen.getByRole("button", { name: "Filter p95 ms" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("DataTable: pagination", () => {
  it("pages the rows with Pagination and a page-size select", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderTable({ defaultPageSize: 2, pageSizeOptions: [2, 4], onPageChange });
    expect(names()).toEqual(["auth", "checkout"]);
    expect(screen.getByText("1–2 of 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(names()).toEqual(["billing"]);
    expect(screen.getByText("5–5 of 5")).toBeInTheDocument();
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(3);

    // The page that holds the first row shown: row 5 is on page 2 of 4-row pages.
    await user.selectOptions(screen.getByRole("combobox", { name: "Rows per page" }), "4");
    expect(names()).toEqual(["billing"]);
    expect(screen.getByText("5–5 of 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Page 1" }));
    expect(names()).toEqual(["auth", "checkout", "récommendations", "search"]);
  });

  it("returns to the first page when a filter or the sort changes; select-all covers the page", async () => {
    const user = userEvent.setup();
    renderTable({ columns: COLUMNS, defaultPageSize: 2, defaultPage: 2, selectable: true });
    expect(names()).toEqual(["récommendations", "search"]);
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(screen.getAllByRole("checkbox", { checked: true }).map((c) => c.getAttribute("aria-label"))).toEqual([
      "Select all rows",
      "Select récommendations",
      "Select search",
    ]);
    await user.type(screen.getByRole("textbox", { name: "Filter Service" }), "a");
    expect(screen.getByText(/^1–2 of/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Page 2" }));
    await user.click(screen.getByRole("button", { name: "Service" }));
    expect(screen.getByText(/^1–2 of/)).toBeInTheDocument();
  });

  it("manualPagination: rows are the page, rowCount sizes the pager", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderTable({ manualPagination: true, rowCount: 95, pageSize: 10, page: 4, onPageChange, rows: ROWS.slice(0, 3) });
    expect(names()).toEqual(["auth", "checkout", "récommendations"]);
    expect(screen.getByText("31–40 of 95")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 10" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(5);
    expect(screen.getByText("31–40 of 95")).toBeInTheDocument();
  });

  it("draws no pager unless asked", () => {
    renderTable();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Rows per page" })).toBeNull();
  });
});

describe("DataTable: sticky columns", () => {
  it("pins the control columns and the first N columns at measured offsets, edge on the last", () => {
    stubLayout({ th: 50 });
    renderTable({ selectable: true, renderDetail: () => "x", stickyColumns: 1 });
    const head = screen.getAllByRole("row")[0] as HTMLElement;
    const cells = [...head.children] as HTMLElement[];
    expect(cells.map((c) => c.classList.contains("r-data-table-sticky"))).toEqual([true, true, true, false, false]);
    expect(cells.map((c) => c.style.insetInlineStart)).toEqual(["0px", "50px", "100px", "", ""]);
    expect(cells.map((c) => c.hasAttribute("data-sticky-edge"))).toEqual([false, false, true, false, false]);
    const first = bodyRows()[0] as HTMLElement;
    const body = [...first.children] as HTMLElement[];
    expect(body.map((c) => c.classList.contains("r-data-table-sticky"))).toEqual([true, true, true, false, false]);
    expect(body[2]).toHaveAttribute("data-sticky-edge");
  });

  it("marks the frame while it is scrolled sideways, so the edge draws only then", () => {
    stubLayout({ th: 50 });
    renderTable({ stickyColumns: 1, "data-testid": "frame" } as Partial<DataTableProps<Svc>>);
    const frame = screen.getByTestId("frame");
    expect(frame).not.toHaveAttribute("data-scrolled-inline");
    act(() => {
      frame.scrollLeft = 40;
      fireEvent.scroll(frame);
    });
    expect(frame).toHaveAttribute("data-scrolled-inline");
    act(() => {
      frame.scrollLeft = 0;
      fireEvent.scroll(frame);
    });
    expect(frame).not.toHaveAttribute("data-scrolled-inline");
  });

  it("pins nothing by default", () => {
    renderTable({ selectable: true });
    expect(document.querySelector(".r-data-table-sticky")).toBeNull();
  });
});

describe("VirtualizedTable: the features a window can hold", () => {
  it("filters, and counts the filter row in the head's row indices", async () => {
    const user = userEvent.setup();
    render(<VirtualizedTable aria-label="Services" columns={COLUMNS} rows={ROWS} getRowKey={(s) => s.id} />);
    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("aria-rowcount", "7");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter Team" }), "payments");
    expect(table).toHaveAttribute("aria-rowcount", "4");
    expect(names()).toEqual(["checkout", "billing"]);
    expect(bodyRows()[0]).toHaveAttribute("aria-rowindex", "3");
  });

  it("has no detail rows or pages, by type", () => {
    const props: VirtualizedTableProps<Svc> = { columns: PLAIN, rows: ROWS, getRowKey: (s) => s.id };
    // @ts-expect-error a detail row would break the fixed row height the window needs
    const withDetail: VirtualizedTableProps<Svc> = { ...props, renderDetail: () => null };
    // @ts-expect-error the window replaces pages
    const withPages: VirtualizedTableProps<Svc> = { ...props, pageSize: 10 };
    expect([withDetail, withPages]).toHaveLength(2);
  });
});
