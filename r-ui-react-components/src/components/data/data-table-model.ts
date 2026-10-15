"use client";
import { type ReactNode, useCallback, useMemo } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber, isPresent, MISSING } from "../../util/format";
import type { ColumnPriority, SortDirection } from "./Table";

export type RowKey = string | number;

export type SortState = { column: string; direction: SortDirection } | null;

export interface DataTableColumn<Row> {
  /** Stable id: the sort state names a column by it. */
  id: string;
  header: ReactNode;
  /**
   * The cell's VALUE: what it sorts by, and (when `cell` is absent) what it
   * shows. Numbers render through `formatNumber`; `null`/`undefined` render "—"
   * and sort last in either direction.
   */
  value?: (row: Row) => string | number | null | undefined;
  /** Custom cell content. Defaults to the formatted `value`. */
  cell?: (row: Row) => ReactNode;
  /** The full text for a truncated cell's `title`. Defaults to the shown value. */
  title?: (row: Row) => string | undefined;
  /** Sortable by default when it has a `value` or `compare`. */
  sortable?: boolean;
  /** Custom order (ascending). Overrides sorting by `value`. */
  compare?: (a: Row, b: Row) => number;
  /** First direction a click picks. Numeric columns start descending (biggest first). */
  firstDirection?: SortDirection;
  numeric?: boolean;
  priority?: ColumnPriority;
  /**
   * One truncating line that shares the free width (default). `false` sizes
   * the column to its content instead (a short status, a date).
   */
  truncate?: boolean;
  /**
   * A CSS width for the column, border-box (it includes the cell's padding):
   * `"calc(8ch + var(--R-SIZE-3) * 2)"`, `"20%"`. In `VirtualizedTable`
   * (fixed layout) it is the width, and unset columns share what is left; in
   * `DataTable` it replaces the column's automatic sizing.
   */
  width?: string;
}

/** The text a column shows for a row by default. */
export function defaultCellText<Row>(column: DataTableColumn<Row>, row: Row): string {
  const v = column.value?.(row);
  if (typeof v === "number") return formatNumber(v);
  if (v === null || v === undefined || v === "") return MISSING;
  return v;
}

export function isSortable<Row>(column: DataTableColumn<Row>): boolean {
  return column.sortable ?? Boolean(column.value || column.compare);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function missing(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && !isPresent(v));
}

/**
 * Rows in `sort` order. Stable (ties keep data order); missing values go last
 * in both directions, because "no data" is never the biggest or the smallest.
 */
export function sortRows<Row>(rows: readonly Row[], columns: readonly DataTableColumn<Row>[], sort: SortState): readonly Row[] {
  if (!sort) return rows;
  const column = columns.find((c) => c.id === sort.column);
  if (!column || !isSortable(column)) return rows;
  const sign = sort.direction === "asc" ? 1 : -1;
  const indexed = rows.map((row, i) => ({ row, i }));
  indexed.sort((a, b) => {
    let c: number;
    if (column.compare) {
      c = column.compare(a.row, b.row) * sign;
    } else {
      const va = column.value?.(a.row);
      const vb = column.value?.(b.row);
      const ma = missing(va);
      const mb = missing(vb);
      if (ma || mb) c = ma && mb ? 0 : ma ? 1 : -1;
      else if (typeof va === "number" && typeof vb === "number") c = (va - vb) * sign;
      else c = collator.compare(String(va), String(vb)) * sign;
    }
    return c || a.i - b.i;
  });
  return indexed.map((x) => x.row);
}

/** The next sort after a header click: the column's first direction, then a toggle. */
export function nextSort<Row>(column: DataTableColumn<Row>, current: SortState): SortState {
  if (current?.column === column.id) {
    return { column: column.id, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { column: column.id, direction: column.firstDirection ?? (column.numeric ? "desc" : "asc") };
}

export interface SortParams {
  sort?: SortState;
  defaultSort?: SortState;
  onSortChange?: (sort: SortState) => void;
}

export function useSort({ sort, defaultSort = null, onSortChange }: SortParams) {
  return useControllableState<SortState>({ value: sort, defaultValue: defaultSort, onChange: onSortChange });
}

export interface SelectionParams {
  selectedKeys?: ReadonlySet<RowKey>;
  defaultSelectedKeys?: ReadonlySet<RowKey>;
  onSelectedKeysChange?: (keys: ReadonlySet<RowKey>) => void;
}

const EMPTY: ReadonlySet<RowKey> = new Set();

/**
 * Row selection over `keys` (every row the table holds, not just a rendered
 * window). Uncontrolled unless `selectedKeys` is passed, so `selectable` alone
 * gives working checkboxes.
 */
export function useSelection(keys: readonly RowKey[], { selectedKeys, defaultSelectedKeys = EMPTY, onSelectedKeysChange }: SelectionParams) {
  const [selected, setSelected] = useControllableState<ReadonlySet<RowKey>>({
    value: selectedKeys,
    defaultValue: defaultSelectedKeys,
    onChange: onSelectedKeysChange,
  });

  const count = useMemo(() => keys.reduce<number>((n, k) => n + (selected.has(k) ? 1 : 0), 0), [keys, selected]);
  const all = keys.length > 0 && count === keys.length;
  const some = count > 0 && !all;

  const toggle = useCallback(
    (key: RowKey, on: boolean) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      }),
    [setSelected],
  );

  const toggleAll = useCallback(
    (on: boolean) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const k of keys) {
          if (on) next.add(k);
          else next.delete(k);
        }
        return next;
      }),
    [keys, setSelected],
  );

  return { selected, all, some, toggle, toggleAll };
}
