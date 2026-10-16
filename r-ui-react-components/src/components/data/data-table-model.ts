"use client";
import { type ReactNode, useCallback, useMemo } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber, isPresent, MISSING } from "../../util/format";
import { foldText } from "../../util/text-match";
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
  /**
   * The column's name in plain text, where `header` is not a string: the
   * columns menu, the resize handle and the filter control are named by it.
   * Defaults to a string `header`, else the `id`.
   */
  label?: string;
  /** Always shown: the columns menu lists it checked and unavailable. */
  required?: boolean;
  /** A filter control for the column, in a row under the head. */
  filter?: DataTableColumnFilter<Row>;
  /** With `resizableColumns`, `false` keeps this column's width fixed. */
  resizable?: boolean;
  /** The narrowest a resize may make the column, a CSS length. Default `DEFAULT_COLUMN_MIN`. */
  minWidth?: string;
  /** The widest a resize may make the column, a CSS length. Default `DEFAULT_COLUMN_MAX`. */
  maxWidth?: string;
}

/** A column's resize floor and cap: two controls wide, and the reading measure. Resolved where the column is drawn, so density moves them. */
export const DEFAULT_COLUMN_MIN = "calc(var(--CONTROL-H) * 2)";
export const DEFAULT_COLUMN_MAX = "var(--MEASURE)";
/** How far one arrow press moves a resize handle. */
export const COLUMN_RESIZE_STEP = "var(--R-SIZE-3)";

/** One choice of a `select` filter. */
export interface DataTableFilterOption {
  value: string;
  label: string;
}

/** What a `custom` filter's `render` is given. */
export interface DataTableFilterControl {
  /** The column's filter value; `undefined` while unfiltered. */
  value: unknown;
  /** Set the value; `undefined`, `""` or an empty array clears the filter. */
  onValueChange: (value: unknown) => void;
  /** The control's accessible name (`labels.filterColumn` of the column's name). */
  label: string;
}

/**
 * A column's filter. `text` keeps rows whose shown text contains the value
 * (case and accents ignored); `select` keeps rows whose `value` equals the
 * chosen option's; `custom` renders the caller's control and matches with the
 * caller's `match`. `match` replaces the default test of the first two.
 */
export type DataTableColumnFilter<Row> =
  | { type: "text"; placeholder?: string; match?: (row: Row, value: string) => boolean }
  | { type: "select"; options: readonly DataTableFilterOption[]; match?: (row: Row, value: string) => boolean }
  | { type: "custom"; render: (control: DataTableFilterControl) => ReactNode; match: (row: Row, value: unknown) => boolean };

/** The filter values, by column id. A missing, `undefined`, `""` or empty-array value filters nothing. */
export type DataTableFilters = Readonly<Record<string, unknown>>;

/** The column's plain-text name. */
export function columnName<Row>(column: DataTableColumn<Row>): string {
  if (column.label !== undefined) return column.label;
  return typeof column.header === "string" || typeof column.header === "number" ? String(column.header) : column.id;
}

/** Whether a filter value filters anything. */
export function isFilterActive(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return !(Array.isArray(value) && value.length === 0);
}

/** Whether any column with a filter holds an active value. */
export function anyFilterActive<Row>(columns: readonly DataTableColumn<Row>[], filters: DataTableFilters): boolean {
  return columns.some((c) => c.filter !== undefined && isFilterActive(filters[c.id]));
}

function filterMatches<Row>(column: DataTableColumn<Row>, row: Row, value: unknown, locale: string | undefined): boolean {
  const filter = column.filter;
  if (!filter) return true;
  if (filter.type === "custom") return filter.match(row, value);
  const needle = String(value);
  if (filter.match) return filter.match(row, needle);
  if (filter.type === "select") return String(column.value?.(row) ?? "") === needle;
  const query = foldText(needle.trim());
  if (query === "") return true;
  const raw = column.value?.(row);
  return foldText(defaultCellText(column, row, locale)).includes(query) || (raw != null && foldText(String(raw)).includes(query));
}

/**
 * The indices of `rows` that pass every active filter (a column's filter
 * applies whether or not the column is shown), in data order.
 */
export function filterIndices<Row>(
  rows: readonly Row[],
  columns: readonly DataTableColumn<Row>[],
  filters: DataTableFilters,
  locale?: string,
): number[] {
  const active = columns.filter((c) => c.filter !== undefined && isFilterActive(filters[c.id]));
  const out: number[] = [];
  rows.forEach((row, i) => {
    if (active.every((c) => filterMatches(c, row, filters[c.id], locale))) out.push(i);
  });
  return out;
}

export interface PageWindow {
  /** The current page, 1-based, clamped into `1..pageCount`. */
  page: number;
  pageCount: number;
  /** The page's first row (inclusive) and last (exclusive), as positions in the whole result. */
  start: number;
  end: number;
}

/** Where page `page` of `total` rows, `pageSize` to a page, starts and ends. */
export function pageWindow(total: number, page: number, pageSize: number): PageWindow {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  return { page: current, pageCount, start, end: Math.min(total, start + size) };
}

/** The text a column shows for a row by default. */
export function defaultCellText<Row>(column: DataTableColumn<Row>, row: Row, locale?: string): string {
  const v = column.value?.(row);
  if (typeof v === "number") return formatNumber(v, { locale });
  if (v === null || v === undefined || v === "") return MISSING;
  return v;
}

export function isSortable<Row>(column: DataTableColumn<Row>): boolean {
  return column.sortable ?? Boolean(column.value || column.compare);
}

const collators = new Map<string, Intl.Collator>();

/** Text order for `locale` ("item 2" before "item 10"), one collator per locale. */
function collatorFor(locale: string | undefined): Intl.Collator {
  const key = locale ?? "";
  let collator = collators.get(key);
  if (!collator) {
    collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    collators.set(key, collator);
  }
  return collator;
}

function missing(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && !isPresent(v));
}

/**
 * The indices of `rows` in `sort` order: a sorted row keeps its source index,
 * which `getRowKey` is given. Stable (ties keep data order); missing values go
 * last in both directions, because "no data" is never the biggest or the smallest.
 */
export function sortOrder<Row>(
  rows: readonly Row[],
  columns: readonly DataTableColumn<Row>[],
  sort: SortState,
  locale?: string,
  /** Sort only these indices of `rows` (the filtered ones). Default: every row. */
  indices: readonly number[] = rows.map((_, i) => i),
): number[] {
  const identity = () => [...indices];
  if (!sort) return identity();
  const column = columns.find((c) => c.id === sort.column);
  if (!column || !isSortable(column)) return identity();
  const sign = sort.direction === "asc" ? 1 : -1;
  const collator = collatorFor(locale);
  const indexed = indices.map((i) => ({ row: rows[i] as Row, i }));
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
  return indexed.map((x) => x.i);
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

  const clear = useCallback(() => setSelected(EMPTY), [setSelected]);

  return { selected, all, some, toggle, toggleAll, clear };
}
