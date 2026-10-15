import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DataTableColumn, RowKey } from "./data-table-model";
import { DataTable, type DataTableProps } from "./DataTable";

interface Svc {
  id: string;
  name: string;
  p95: number | null;
}

const ROWS: Svc[] = [
  { id: "a", name: "auth", p95: 41 },
  { id: "c", name: "checkout", p95: 640 },
  { id: "r", name: "recs", p95: null },
  { id: "s", name: "search", p95: 212 },
];

const COLUMNS: DataTableColumn<Svc>[] = [
  { id: "name", header: "Service", value: (s) => s.name },
  { id: "p95", header: "p95 ms", value: (s) => s.p95, numeric: true },
];

function renderTable(props: Partial<DataTableProps<Svc>> = {}) {
  return render(
    <DataTable aria-label="Services" columns={COLUMNS} rows={ROWS} getRowKey={(s) => s.id} {...props} />,
  );
}

/** First-column text of each body row, in DOM order. */
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

/** The checkbox for a body row by its accessible name. */
const box = (name: string) => screen.getByRole("checkbox", { name });

describe("DataTable", () => {
  it("renders rows in data order until sorted, missing values as an em dash", () => {
    renderTable();
    expect(names()).toEqual(["auth", "checkout", "recs", "search"]);
    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("sorts a numeric column biggest-first, then toggles; missing sorts last both ways", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderTable({ onSortChange });
    const header = () => screen.getByRole("columnheader", { name: "p95 ms" });

    await user.click(screen.getByRole("button", { name: "p95 ms" }));
    expect(names()).toEqual(["checkout", "search", "auth", "recs"]);
    expect(header()).toHaveAttribute("aria-sort", "descending");
    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "p95", direction: "desc" });

    await user.click(screen.getByRole("button", { name: "p95 ms" }));
    expect(names()).toEqual(["auth", "search", "checkout", "recs"]);
    expect(header()).toHaveAttribute("aria-sort", "ascending");
    expect(onSortChange).toHaveBeenCalledTimes(2);
  });

  it("sorts a text column A to Z first", async () => {
    const user = userEvent.setup();
    renderTable({ defaultSort: { column: "p95", direction: "desc" } });
    await user.click(screen.getByRole("button", { name: "Service" }));
    expect(names()).toEqual(["auth", "checkout", "recs", "search"]);
    expect(screen.getByRole("columnheader", { name: "Service" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "p95 ms" })).not.toHaveAttribute("aria-sort");
  });

  it("controlled sort: reports the click, reorders only when the parent passes it back", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const { rerender } = renderTable({ sort: null, onSortChange });
    await user.click(screen.getByRole("button", { name: "p95 ms" }));
    expect(onSortChange).toHaveBeenCalledExactlyOnceWith({ column: "p95", direction: "desc" });
    expect(names()).toEqual(["auth", "checkout", "recs", "search"]);

    rerender(
      <DataTable
        aria-label="Services"
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={(s) => s.id}
        sort={{ column: "p95", direction: "desc" }}
        onSortChange={onSortChange}
      />,
    );
    expect(names()).toEqual(["checkout", "search", "auth", "recs"]);
  });

  it("manualSorting shows the sort but never reorders", () => {
    renderTable({ manualSorting: true, defaultSort: { column: "p95", direction: "desc" } });
    expect(screen.getByRole("columnheader", { name: "p95 ms" })).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["auth", "checkout", "recs", "search"]);
  });

  it("selects rows uncontrolled, with an indeterminate select-all", async () => {
    const user = userEvent.setup();
    const onSelectedKeysChange = vi.fn();
    renderTable({ selectable: true, onSelectedKeysChange });
    const all = screen.getByRole("checkbox", { name: "Select all rows" });
    expect(all).not.toBeChecked();
    expect(all).not.toBePartiallyChecked();

    await user.click(box("Select checkout"));
    expect(box("Select checkout")).toBeChecked();
    expect(all).toBePartiallyChecked();
    expect(screen.getByRole("row", { selected: true })).toHaveTextContent("checkout");
    expect(onSelectedKeysChange).toHaveBeenCalledTimes(1);
    expect([...(onSelectedKeysChange.mock.lastCall?.[0] as Set<RowKey>)]).toEqual(["c"]);

    await user.click(all);
    expect(all).toBeChecked();
    expect(all).not.toBePartiallyChecked();
    for (const name of ["auth", "checkout", "recs", "search"]) expect(box(`Select ${name}`)).toBeChecked();

    await user.click(all);
    for (const name of ["auth", "checkout", "recs", "search"]) expect(box(`Select ${name}`)).not.toBeChecked();
    expect(onSelectedKeysChange).toHaveBeenCalledTimes(3);
  });

  it("selects rows controlled: the parent owns the set", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [keys, setKeys] = useState<ReadonlySet<RowKey>>(new Set(["s"]));
      return (
        <>
          <DataTable
            aria-label="Services"
            columns={COLUMNS}
            rows={ROWS}
            getRowKey={(s) => s.id}
            selectable
            selectedKeys={keys}
            onSelectedKeysChange={setKeys}
            getRowLabel={(s) => `Pick ${s.name}`}
          />
          <output>{[...keys].sort().join(",")}</output>
        </>
      );
    }
    render(<Controlled />);
    expect(box("Pick search")).toBeChecked();
    await user.click(box("Pick auth"));
    expect(screen.getByRole("status")).toHaveTextContent("a,s");
    expect(box("Pick auth")).toBeChecked();
  });

  it("publishes no aria-selected without selection", () => {
    renderTable();
    for (const row of screen.getAllByRole("row")) expect(row).not.toHaveAttribute("aria-selected");
  });

  it("loading: the head stays, the body is skeleton rows, the table is busy", () => {
    renderTable({ loading: true, loadingRows: 3, selectable: true });
    const table = screen.getByRole("table", { name: "Services" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("columnheader", { name: "p95 ms" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select all rows" })).toBeDisabled();
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(4);
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("checkout")).toBeNull();
  });

  it("empty: a default state, or the caller's", () => {
    const { rerender } = renderTable({ rows: [] });
    const cell = screen.getByText("No data").closest("td");
    expect(cell).toHaveAttribute("colspan", "2");
    rerender(
      <DataTable
        aria-label="Services"
        columns={COLUMNS}
        rows={[]}
        getRowKey={(s) => s.id}
        selectable
        empty={<p>Nothing matches</p>}
      />,
    );
    expect(screen.getByText("Nothing matches").closest("td")).toHaveAttribute("colspan", "3");
    expect(screen.queryByText("No data")).toBeNull();
  });

  it("error: an alert with the message and its actions, instead of rows", () => {
    renderTable({ error: "Couldn't load services", errorActions: <button type="button">Retry</button> });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load services");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("checkout")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Service" })).toBeInTheDocument();
  });

  it("renders row actions per row under a screen-reader-only header", () => {
    renderTable({ rowActions: (s) => <button type="button">Open {s.name}</button>, rowActionsLabel: "Row actions" });
    expect(screen.getByRole("columnheader", { name: "Row actions" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4);
    expect(screen.getByText("Row actions")).toHaveClass("sr-only");
  });

  it("names a row checkbox from the first column by default", () => {
    renderTable({ selectable: true });
    expect(box("Select recs")).toBeInTheDocument();
  });

  it("drops columns by priority on every cell of the column", () => {
    render(
      <DataTable
        aria-label="Services"
        columns={[COLUMNS[0] as DataTableColumn<Svc>, { ...(COLUMNS[1] as DataTableColumn<Svc>), priority: 4 }]}
        rows={ROWS}
        getRowKey={(s) => s.id}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "p95 ms" })).toHaveClass("@max-2xl/table:hidden");
    expect(screen.getByRole("cell", { name: "640" })).toHaveClass("@max-2xl/table:hidden");
  });
});

