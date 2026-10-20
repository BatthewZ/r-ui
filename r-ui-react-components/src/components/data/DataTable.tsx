"use client";
import { Inbox, TriangleAlert } from "lucide-react";
import {
  type CSSProperties,
  type FocusEvent,
  Fragment,
  type ReactNode,
  type UIEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useRowHeight } from "../../hooks/use-row-height";
import { useVirtualRows } from "../../hooks/use-virtual-rows";
import { formatNumber } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { resolveLength } from "../../util/resolve-length";
import { cn, type SlotClassNames } from "../../util/style";
import { Checkbox } from "../form";
import { Button, Skeleton } from "../primitives";
import {
  anyFilterActive,
  COLUMN_RESIZE_STEP,
  columnName,
  DEFAULT_COLUMN_MAX,
  DEFAULT_COLUMN_MIN,
  type DataTableColumn,
  type DataTableFilters,
  defaultCellText,
  filterIndices,
  isSortable,
  nextSort,
  pageWindow,
  type RowKey,
  type SelectionParams,
  type SortParams,
  type SortState,
  sortOrder,
  useSelection,
  useSort,
} from "./data-table-model";
import {
  BulkBar,
  ClearFiltersButton,
  ColumnResizeHandle,
  ColumnsMenu,
  DetailToggle,
  FilterControl,
  PaginationBar,
} from "./data-table-parts";
import { EmptyState } from "./EmptyState";
import { Table, type TableProps } from "./Table";
import { type ColumnBounds, useColumnGeometry } from "./use-column-geometry";

export interface DataTableProps<Row>
  extends SortParams,
    SelectionParams,
    Omit<TableProps, "children" | "classNames" | "tableProps" | "footer"> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /**
   * A stable key per row: selection, expansion and React reconciliation all
   * use it. `index` is the row's position in `rows`, whatever the sort.
   */
  getRowKey: (row: Row, index: number) => RowKey;
  /**
   * The rows arrive already in `sort` order (a server sorts them). The table
   * still shows and reports the sort; it never reorders.
   */
  manualSorting?: boolean;
  /** Adds a checkbox column with a select-all header (over every row the table presents: all filtered rows, or the page). */
  selectable?: boolean;
  /** The accessible name of a row's checkbox. Default: `labels.selectRow` of the first column's text. */
  getRowLabel?: (row: Row) => string;
  /** Per-row trailing actions (icon buttons, a menu). */
  rowActions?: (row: Row) => ReactNode;
  /** Show skeleton rows (the head stays) and mark the table busy. */
  loading?: boolean;
  /** How many skeleton rows to draw while loading. */
  loadingRows?: number;
  /** A failure message. Shown instead of rows, with `errorActions` (a retry). */
  error?: ReactNode;
  errorActions?: ReactNode;
  /** What an empty table shows. Default: a quiet "No data" state. Filters that match nothing show their own state. */
  empty?: ReactNode;
  /** A visible caption naming the table (or pass `aria-label`). */
  caption?: ReactNode;

  /**
   * A detail row under each row, opened by a disclosure button in a leading
   * column. Called only for open rows. Not in `VirtualizedTable`.
   */
  renderDetail?: (row: Row) => ReactNode;
  /** The open rows' keys (controlled). */
  expandedKeys?: ReadonlySet<RowKey>;
  defaultExpandedKeys?: ReadonlySet<RowKey>;
  onExpandedKeysChange?: (keys: ReadonlySet<RowKey>) => void;

  /** A columns menu in the head's trailing cell: one checkbox per column (`required` columns stay). */
  columnsMenu?: boolean;
  /** The ids of the columns shown (controlled). Default: every column. `required` columns show either way. */
  visibleColumns?: ReadonlySet<string>;
  defaultVisibleColumns?: ReadonlySet<string>;
  onVisibleColumnsChange?: (ids: ReadonlySet<string>) => void;

  /**
   * A resize handle on every header (a column's `resizable: false` opts out):
   * drag it, or focus it and use the arrows, Home and End. Widths are px,
   * kept between the column's `minWidth` and `maxWidth`.
   */
  resizableColumns?: boolean;
  /** Widths set by resizing, px by column id (controlled). A column without one sizes as usual. */
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>) => void;

  /**
   * With `selectable`: a bar at the bottom of the table's frame while rows are
   * selected, with the count, these actions and "Clear selection". It sticks
   * to the bottom of the table's own scroll area.
   */
  bulkActions?: (selectedKeys: ReadonlySet<RowKey>) => ReactNode;

  /** The column filters' values, by column id (controlled). Columns opt in with `filter`. */
  filters?: DataTableFilters;
  defaultFilters?: DataTableFilters;
  onFiltersChange?: (filters: DataTableFilters) => void;
  /** The rows arrive already filtered (a server filters them); the table still shows and reports the filters. */
  manualFiltering?: boolean;

  /** Rows per page (controlled). Passing it or `defaultPageSize` pages the table. */
  pageSize?: number;
  defaultPageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  /** The choices of the rows-per-page select. Default 10, 25, 50, 100 (plus the current size). */
  pageSizeOptions?: readonly number[];
  /** The page, 1-based (controlled). A filter, sort or page-size change returns to the page holding the first row shown. */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** `rows` is the current page (a server pages them); `rowCount` is the total the pages are cut from. */
  manualPagination?: boolean;
  /** With `manualPagination`: how many rows there are in all. */
  rowCount?: number;

  /**
   * Pin this many leading columns (and the expand and checkbox columns before
   * them) to the inline-start edge while the table scrolls sideways. Their edge
   * draws a rule only while something is scrolled under it. Sticky cells paint
   * `--r-data-table-surface` (default `--C-SURFACE-0`): set it when the table
   * sits on another surface.
   */
  stickyColumns?: number;

  labels?: LabelsProp<DataTableLabels>;
  classNames?: SlotClassNames<
    "table" | "row" | "headerCell" | "cell" | "empty" | "detail" | "filterCell" | "bulkBar" | "pagination"
  >;
}

export interface DataTableLabels {
  /** The select-all checkbox's name. */
  selectAll: string;
  /** A row checkbox's name, from the first column's text (`""` when there is no column). */
  selectRow: (text: string) => string;
  /** The actions column's header, read by screen readers only. */
  rowActions: string;
  /** Announced while `loading`. */
  loading: string;
  /** The default empty state's title. */
  empty: string;
  /** The expand column's header, read by screen readers only. */
  detailsColumn: string;
  /** A row's disclosure button, from the first column's text (its state is `aria-expanded`). */
  details: (text: string) => string;
  /** The columns menu button's name. */
  columns: string;
  /** A resize handle's name, from the column's name. */
  resizeColumn: (column: string) => string;
  /** A filter control's name, from the column's name. */
  filterColumn: (column: string) => string;
  /** A select filter's "no filter" choice. */
  filterAll: string;
  /** The clear-all-filters button. */
  clearFilters: string;
  /** The empty state's title when filters match nothing. */
  noMatches: string;
  /** The bulk bar's count, and what is announced when it changes. */
  selectedCount: (count: number) => string;
  /** The bulk bar's name. */
  bulkActions: string;
  clearSelection: string;
  /** The page-size select's label. */
  rowsPerPage: string;
  /** The rows shown, 1-based and inclusive, of the total. */
  pageRange: (from: number, to: number, total: number) => string;
}

export const DEFAULT_DATA_TABLE_LABELS: DataTableLabels = {
  selectAll: "Select all rows",
  selectRow: (text) => (text ? `Select ${text}` : "Select row"),
  rowActions: "Actions",
  loading: "Loading",
  empty: "No data",
  detailsColumn: "Details",
  details: (text) => (text ? `Details for ${text}` : "Row details"),
  columns: "Columns",
  resizeColumn: (column) => `Resize ${column}`,
  filterColumn: (column) => `Filter ${column}`,
  filterAll: "All",
  clearFilters: "Clear filters",
  noMatches: "No rows match the filters",
  selectedCount: (count) => `${count} selected`,
  bulkActions: "Selected rows",
  clearSelection: "Clear selection",
  rowsPerPage: "Rows per page",
  pageRange: (from, to, total) =>
    total === 0 ? "0 of 0" : `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    DataTable: DataTableLabels;
  }
}

/** Internal: VirtualizedTable reuses everything here and windows the body. */
interface ViewProps<Row> extends DataTableProps<Row> {
  windowed?: { visibleRows: number; overscan: number };
}

/** Fixed layout only: sized to the checkbox's hit floor plus cell padding, so it cannot clip. */
const CONTROL_COLUMN = "w-[calc(var(--HIT-MIN)+var(--R-SIZE-3)*2)]";
const ACTIONS_COLUMN = "w-[calc(var(--CONTROL-H)+var(--R-SIZE-3)*2)]";

/** The keys of the columns the table adds itself, in `data-column-key`. */
const EXPAND_KEY = "__expand";
const SELECT_KEY = "__select";

const DEFAULT_PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
const NO_KEYS: ReadonlySet<RowKey> = new Set();
const NO_FILTERS: DataTableFilters = {};
const NO_WIDTHS: Readonly<Record<string, number>> = {};

/** A px count as a CSS length (unitless in state, so a gate never sees a literal). */
const pxLength = (px: number) => `calc(${px} * 1px)`;

/** A key as an id fragment: ids hold no whitespace. */
const idPart = (key: RowKey) => String(key).replace(/\s+/g, "_");

export function DataTableView<Row>({
  columns,
  rows,
  getRowKey,
  sort: sortProp,
  defaultSort,
  onSortChange,
  manualSorting = false,
  selectable = false,
  selectedKeys,
  defaultSelectedKeys,
  onSelectedKeysChange,
  getRowLabel,
  rowActions,
  loading = false,
  loadingRows = 5,
  labels: labelsProp,
  error,
  errorActions,
  empty,
  caption,
  renderDetail,
  expandedKeys,
  defaultExpandedKeys,
  onExpandedKeysChange,
  columnsMenu = false,
  visibleColumns,
  defaultVisibleColumns,
  onVisibleColumnsChange,
  resizableColumns = false,
  columnWidths: columnWidthsProp,
  defaultColumnWidths,
  onColumnWidthsChange,
  bulkActions,
  filters: filtersProp,
  defaultFilters,
  onFiltersChange,
  manualFiltering = false,
  pageSize: pageSizeProp,
  defaultPageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  page: pageProp,
  defaultPage,
  onPageChange,
  manualPagination = false,
  rowCount,
  stickyColumns = 0,
  classNames,
  windowed,
  ref,
  onScroll,
  onFocusCapture,
  ...tableRest
}: ViewProps<Row>) {
  const labels = useLabels("DataTable", DEFAULT_DATA_TABLE_LABELS, labelsProp);
  const locale = useLocale();
  const baseId = useId();
  const variant = tableRest.variant ?? "boxed";
  const stickyHeader = tableRest.stickyHeader ?? false;

  // Columns shown: `undefined` (the uncontrolled default) is every column.
  const [visibleSet, setVisibleSet] = useControllableState<ReadonlySet<string> | undefined>({
    value: visibleColumns,
    defaultValue: defaultVisibleColumns,
    onChange: (next) => next && onVisibleColumnsChange?.(next),
  });
  const isShown = useCallback(
    (column: DataTableColumn<Row>) => Boolean(column.required) || !visibleSet || visibleSet.has(column.id),
    [visibleSet],
  );
  const shown = useMemo(() => columns.filter(isShown), [columns, isShown]);
  const toggleColumn = (id: string, on: boolean) =>
    setVisibleSet((prev) => {
      const next = new Set(prev ?? columns.map((c) => c.id));
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // Filter, then sort, then page. Every step works on indices into `rows`.
  const [filters, setFilters] = useControllableState<DataTableFilters>({
    value: filtersProp,
    defaultValue: defaultFilters ?? NO_FILTERS,
    onChange: onFiltersChange,
  });
  const hasFilters = columns.some((c) => c.filter !== undefined);
  const filtersActive = hasFilters && anyFilterActive(columns, filters);
  const filtered = useMemo(
    () => (manualFiltering || !hasFilters ? rows.map((_, i) => i) : filterIndices(rows, columns, filters, locale)),
    [manualFiltering, hasFilters, rows, columns, filters, locale],
  );
  const [sort, setSortState] = useSort({ sort: sortProp, defaultSort, onSortChange });
  const order = useMemo(
    () => (manualSorting ? filtered : sortOrder(rows, columns, sort, locale, filtered)),
    [manualSorting, filtered, rows, columns, sort, locale],
  );

  const paginated = !windowed && (pageSizeProp !== undefined || defaultPageSize !== undefined);
  const [pageSize, setPageSize] = useControllableState({
    value: pageSizeProp,
    defaultValue: defaultPageSize ?? DEFAULT_PAGE_SIZES[0] ?? 10,
    onChange: onPageSizeChange,
  });
  const [rawPage, setPage] = useControllableState({ value: pageProp, defaultValue: defaultPage ?? 1, onChange: onPageChange });
  const total = paginated && manualPagination ? Math.max(0, rowCount ?? rows.length) : order.length;
  const pager = pageWindow(total, rawPage, pageSize);
  const presented = useMemo(
    () => (paginated && !manualPagination ? order.slice(pager.start, pager.end) : order),
    [paginated, manualPagination, order, pager.start, pager.end],
  );
  const presentedRows = useMemo(() => presented.map((i) => rows[i] as Row), [presented, rows]);
  const keys = useMemo(() => presented.map((i) => getRowKey(rows[i] as Row, i)), [presented, rows, getRowKey]);

  // What the rows mean changed: start over from the first page.
  const changeFilters = (next: DataTableFilters) => {
    setFilters(next);
    if (paginated) setPage(1);
  };
  const setSort = (next: SortState) => {
    setSortState(next);
    if (paginated) setPage(1);
  };
  // Keep the first row shown on the page that now holds it.
  const changePageSize = (next: number) => {
    setPageSize(next);
    setPage(Math.floor(pager.start / Math.max(1, next)) + 1);
  };

  const selection = useSelection(keys, { selectedKeys, defaultSelectedKeys, onSelectedKeysChange });
  const [expanded, setExpanded] = useControllableState<ReadonlySet<RowKey>>({
    value: expandedKeys,
    defaultValue: defaultExpandedKeys ?? NO_KEYS,
    onChange: onExpandedKeysChange,
  });
  const expandable = renderDetail !== undefined && !windowed;
  const toggleExpanded = (key: RowKey) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const [widths, setWidths] = useControllableState<Readonly<Record<string, number>>>({
    value: columnWidthsProp,
    defaultValue: defaultColumnWidths ?? NO_WIDTHS,
    onChange: onColumnWidthsChange,
  });
  const resizable = (column: DataTableColumn<Row>) => resizableColumns && column.resizable !== false;

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = useRowHeight(scrollRef, 40, Boolean(windowed));
  const visibleRows = windowed?.visibleRows ?? 0;
  const virtual = useVirtualRows({
    rowCount: windowed ? presentedRows.length : 0,
    rowHeight,
    overscan: windowed?.overscan ?? 0,
    scrollRef,
    initialViewport: rowHeight * visibleRows,
  });

  // Geometry: what sticky offsets and resize handles read.
  const leadKeys = [...(expandable ? [EXPAND_KEY] : []), ...(selectable ? [SELECT_KEY] : [])];
  const stickyCount = Math.max(0, Math.min(Math.floor(stickyColumns), shown.length));
  const stickyKeys = stickyCount > 0 ? [...leadKeys, ...shown.slice(0, stickyCount).map((c) => c.id)] : [];
  const bounds = useMemo(() => {
    const out: Record<string, ColumnBounds> = {};
    for (const c of shown) {
      if (resizableColumns && c.resizable !== false) {
        out[c.id] = { min: c.minWidth ?? DEFAULT_COLUMN_MIN, max: c.maxWidth ?? DEFAULT_COLUMN_MAX };
      }
    }
    return out;
  }, [shown, resizableColumns]);
  const geometry = useColumnGeometry(
    scrollRef,
    [...leadKeys, ...shown.map((c) => c.id)],
    bounds,
    stickyCount > 0 || resizableColumns,
  );
  const stickyOffset = new Map<string, number>();
  stickyKeys.reduce((at, key) => {
    stickyOffset.set(key, at);
    return at + (geometry[key]?.width ?? 0);
  }, 0);
  const edgeKey = stickyKeys[stickyKeys.length - 1];
  const sticky = (key: string): { className?: string; style?: CSSProperties; "data-sticky-edge"?: "" } =>
    stickyOffset.has(key)
      ? {
          className: "r-data-table-sticky",
          style: { insetInlineStart: stickyOffset.get(key) },
          "data-sticky-edge": key === edgeKey ? "" : undefined,
        }
      : {};

  // The pinned edge draws its rule only while something is scrolled under it.
  const [scrolledInline, setScrolledInline] = useState(false);
  const trackScroll = (event: UIEvent<HTMLDivElement>) => {
    if (stickyCount === 0) return;
    const scrolled = Math.abs(event.currentTarget.scrollLeft) > 0.5;
    if (scrolled !== scrolledInline) setScrolledInline(scrolled);
  };

  const captionId = useId();
  const hasTrailing = Boolean(rowActions) || columnsMenu || hasFilters;
  const columnCount = shown.length + leadKeys.length + (hasTrailing ? 1 : 0);
  const headRows = hasFilters ? 2 : 1;
  const state: "loading" | "error" | "empty" | "rows" = loading
    ? "loading"
    : error
      ? "error"
      : presentedRows.length === 0
        ? "empty"
        : "rows";

  const firstText = (row: Row) => {
    const first = columns[0];
    return first ? defaultCellText(first, row, locale) : "";
  };
  const rowLabel = (row: Row) => (getRowLabel ? getRowLabel(row) : labels.selectRow(firstText(row)));

  // Clearing the selection removes the bar, and with it the focused button:
  // focus goes to select-all instead of <body>.
  const selectAllRef = useRef<HTMLInputElement>(null);
  const focusInBar = useRef(false);
  const selectedCount = selection.selected.size;
  useLayoutEffect(() => {
    if (selectedCount > 0 || !focusInBar.current) return;
    focusInBar.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) selectAllRef.current?.focus();
  }, [selectedCount]);

  const start = windowed ? virtual.startIndex : 0;
  const end = windowed ? virtual.endIndex : presentedRows.length;
  const padTop = windowed ? virtual.paddingTop : 0;
  const padBottom = windowed ? virtual.paddingBottom : 0;
  const headBand = variant === "boxed" || stickyHeader;

  const header = (
    <Table.Head className={cn(stickyCount > 0 && stickyHeader && "z-sticky")}>
      <Table.Row aria-rowindex={windowed ? 1 : undefined}>
        {expandable && (
          <Table.HeaderCell
            truncate={false}
            data-column-key={EXPAND_KEY}
            {...sticky(EXPAND_KEY)}
            className={cn(sticky(EXPAND_KEY).className, classNames?.headerCell)}
          >
            <span className="sr-only">{labels.detailsColumn}</span>
          </Table.HeaderCell>
        )}
        {selectable && (
          // Auto layout shrinks the column to the box (its hit area overflows
          // the cell); fixed layout needs the width said out loud.
          <Table.HeaderCell
            truncate={false}
            data-column-key={SELECT_KEY}
            {...sticky(SELECT_KEY)}
            className={cn(windowed && CONTROL_COLUMN, sticky(SELECT_KEY).className, classNames?.headerCell)}
          >
            <Checkbox
              ref={selectAllRef}
              aria-label={labels.selectAll}
              checked={selection.all}
              indeterminate={selection.some}
              disabled={state !== "rows"}
              onCheckedChange={() => selection.toggleAll(!selection.all)}
            />
          </Table.HeaderCell>
        )}
        {shown.map((column) => {
          const sortable = isSortable(column);
          const active = sort?.column === column.id ? sort.direction : null;
          const set = widths[column.id];
          const width = set !== undefined ? pxLength(set) : column.width;
          // A resizable column's automatic width keeps its min too, so a table at its own
          // width grows when one column widens instead of squeezing a truncating one to nothing.
          const floor = !width && resizable(column) ? (column.minWidth ?? DEFAULT_COLUMN_MIN) : undefined;
          const pin = sticky(column.id);
          const canResize = resizable(column);
          const g = geometry[column.id];
          const drawn = g && g.width > 0 ? g.width : undefined;
          return (
            <Table.HeaderCell
              key={column.id}
              data-column-key={column.id}
              numeric={column.numeric}
              priority={column.priority}
              truncate={column.truncate}
              sort={active}
              onSort={sortable ? () => setSort(nextSort(column, sort)) : undefined}
              // Through a custom property and classes, not an inline width: a
              // dropped column must give its width back (the priority class
              // zeroes it), and an inline style would outrank that. `max-w` too,
              // or a truncating header's own `max-w-0` caps the width; `min-w`,
              // or auto layout squeezes the column back into a table at its
              // width (a resize takes from its neighbours instead of growing it).
              style={{
                ...(width ? ({ "--col-w": width } as CSSProperties) : undefined),
                ...(floor ? ({ "--col-min": floor } as CSSProperties) : undefined),
                ...pin.style,
              }}
              data-sticky-edge={pin["data-sticky-edge"]}
              className={cn(
                width && "w-(--col-w) min-w-(--col-w) max-w-(--col-w)",
                floor && "min-w-(--col-min)",
                // A sticky cell is already the handle's containing block.
                canResize && !pin.className && "relative",
                pin.className,
                classNames?.headerCell,
              )}
              after={
                canResize && (
                  <ColumnResizeHandle
                    label={labels.resizeColumn(columnName(column))}
                    width={set ?? drawn}
                    min={g?.min ?? 0}
                    max={g?.max ?? 0}
                    start={() => {
                      const cell = [
                        ...(scrollRef.current?.querySelectorAll<HTMLElement>("thead tr:first-child > [data-column-key]") ?? []),
                      ].find((el) => el.dataset.columnKey === column.id);
                      if (!cell) return { width: set ?? 0, min: 0, max: 0, step: 1 };
                      return {
                        width: cell.getBoundingClientRect().width,
                        min: resolveLength(cell, column.minWidth ?? DEFAULT_COLUMN_MIN),
                        max: resolveLength(cell, column.maxWidth ?? DEFAULT_COLUMN_MAX),
                        step: resolveLength(cell, COLUMN_RESIZE_STEP),
                      };
                    }}
                    onResize={(px) => setWidths((prev) => (prev[column.id] === px ? prev : { ...prev, [column.id]: px }))}
                    onReset={() =>
                      setWidths((prev) => {
                        if (!(column.id in prev)) return prev;
                        const next = { ...prev };
                        delete next[column.id];
                        return next;
                      })
                    }
                  />
                )
              }
            >
              {column.header}
            </Table.HeaderCell>
          );
        })}
        {hasTrailing && (
          <Table.HeaderCell
            truncate={false}
            className={cn(windowed && ACTIONS_COLUMN, "text-end", classNames?.headerCell)}
          >
            {rowActions && <span className="sr-only">{labels.rowActions}</span>}
            {columnsMenu && <ColumnsMenu columns={columns} isShown={isShown} onToggle={toggleColumn} labels={labels} />}
          </Table.HeaderCell>
        )}
      </Table.Row>
      {hasFilters && (
        <Table.Row aria-rowindex={windowed ? 2 : undefined} data-table-filters="" data-print="hide">
          {leadKeys.map((key) => {
            const pin = sticky(key);
            return <Table.Cell key={key} truncate={false} {...pin} className={cn(headBand && "bg-surface-1", pin.className)} />;
          })}
          {shown.map((column) => {
            const pin = sticky(column.id);
            return (
              <Table.Cell
                key={column.id}
                numeric={column.numeric}
                priority={column.priority}
                truncate={column.truncate}
                {...pin}
                className={cn(headBand && "bg-surface-1", "text-start", pin.className, classNames?.filterCell)}
              >
                <FilterControl
                  column={column}
                  value={filters[column.id]}
                  onValueChange={(value) => changeFilters({ ...filters, [column.id]: value })}
                  labels={labels}
                />
              </Table.Cell>
            );
          })}
          <Table.Cell truncate={false} className={cn(headBand && "bg-surface-1", "text-end")}>
            <ClearFiltersButton columns={columns} filters={filters} onClear={() => changeFilters(NO_FILTERS)} labels={labels} />
          </Table.Cell>
        </Table.Row>
      )}
    </Table.Head>
  );

  let body: ReactNode;
  if (state === "loading") {
    body = Array.from({ length: loadingRows }, (_, i) => (
      <Table.Row key={i} aria-hidden={i > 0 || undefined}>
        {leadKeys.map((key) => (
          <Table.Cell key={key} truncate={false} {...sticky(key)} />
        ))}
        {shown.map((column, c) => (
          <Table.Cell key={column.id} numeric={column.numeric} priority={column.priority} {...sticky(column.id)}>
            {i === 0 && c === 0 && <span className="sr-only">{labels.loading}</span>}
            <Skeleton
              shape="block"
              className={cn("inline-block h-r3 rounded-sm align-middle", column.numeric ? "w-1/2" : c === 0 ? "w-3/4" : "w-2/3")}
            />
          </Table.Cell>
        ))}
        {hasTrailing && <Table.Cell truncate={false} />}
      </Table.Row>
    ));
  } else if (state === "error" || state === "empty") {
    const noMatches = state === "empty" && filtersActive;
    body = (
      <Table.Row>
        <Table.Cell colSpan={columnCount} truncate={false} className={cn("whitespace-normal", classNames?.empty)}>
          {state === "error" ? (
            <EmptyState role="alert" tone="error" icon={<TriangleAlert />} title={error} actions={errorActions} />
          ) : noMatches ? (
            <EmptyState
              icon={<Inbox />}
              title={labels.noMatches}
              actions={
                <Button variant="secondary" onClick={() => changeFilters(NO_FILTERS)}>
                  {labels.clearFilters}
                </Button>
              }
            />
          ) : (
            (empty ?? <EmptyState icon={<Inbox />} title={labels.empty} />)
          )}
        </Table.Cell>
      </Table.Row>
    );
  } else {
    body = (
      <>
        {windowed && padTop > 0 && <Spacer height={padTop} />}
        {presentedRows.slice(start, end).map((row, offset) => {
          const index = start + offset;
          const key = keys[index] as RowKey;
          const isSelected = selectable ? selection.selected.has(key) : undefined;
          const isOpen = expandable && expanded.has(key);
          const detailId = `${baseId}-detail-${idPart(key)}`;
          return (
            <Fragment key={key}>
              <Table.Row
                index={index}
                selected={isSelected}
                aria-rowindex={windowed ? index + headRows + 1 : undefined}
                className={classNames?.row}
              >
                {expandable && (
                  <Table.Cell truncate={false} {...sticky(EXPAND_KEY)} className={cn(sticky(EXPAND_KEY).className, classNames?.cell)}>
                    <DetailToggle
                      expanded={isOpen}
                      controls={detailId}
                      label={labels.details(firstText(row))}
                      onToggle={() => toggleExpanded(key)}
                    />
                  </Table.Cell>
                )}
                {selectable && (
                  <Table.Cell truncate={false} {...sticky(SELECT_KEY)} className={cn(sticky(SELECT_KEY).className, classNames?.cell)}>
                    <Checkbox
                      aria-label={rowLabel(row)}
                      checked={isSelected}
                      onCheckedChange={(on: boolean) => selection.toggle(key, on)}
                    />
                  </Table.Cell>
                )}
                {shown.map((column) => {
                  const text = column.cell ? undefined : defaultCellText(column, row, locale);
                  const pin = sticky(column.id);
                  return (
                    <Table.Cell
                      key={column.id}
                      numeric={column.numeric}
                      priority={column.priority}
                      truncate={column.truncate}
                      title={column.title?.(row) ?? text}
                      {...pin}
                      className={cn(pin.className, classNames?.cell)}
                    >
                      {column.cell ? column.cell(row) : text}
                    </Table.Cell>
                  );
                })}
                {hasTrailing && (
                  <Table.Cell truncate={false} className={cn("text-end", classNames?.cell)}>
                    {rowActions?.(row)}
                  </Table.Cell>
                )}
              </Table.Row>
              {isOpen && (
                <tr id={detailId} data-table-detail="">
                  <Table.Cell colSpan={columnCount} wrap className={cn("r-data-table-detail", classNames?.detail)}>
                    {/* Pinned to the frame's start and as wide as the frame (the
                        root is the `table` container), so a wide table's detail
                        stays in view while the row scrolls sideways. */}
                    <div className="sticky start-0 max-w-[100cqi] text-body-2">{renderDetail?.(row)}</div>
                  </Table.Cell>
                </tr>
              )}
            </Fragment>
          );
        })}
        {windowed && padBottom > 0 && <Spacer height={padBottom} />}
      </>
    );
  }

  const bulk = selectable && bulkActions !== undefined;
  const footer =
    bulk || paginated ? (
      <div className="r-data-table-footer" data-print="hide">
        {bulk && (
          <BulkBar
            count={selectedCount}
            actions={selectedCount > 0 ? bulkActions(selection.selected) : null}
            onClear={selection.clear}
            labels={labels}
            className={classNames?.bulkBar}
          />
        )}
        {paginated && (
          <PaginationBar
            page={pager.page}
            pageCount={pager.pageCount}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            from={total === 0 ? 0 : pager.start + 1}
            to={pager.end}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            labels={labels}
            locale={locale}
            ruled={variant === "boxed" && !(bulk && selectedCount > 0)}
            className={classNames?.pagination}
          />
        )}
      </div>
    ) : undefined;

  return (
    <Table
      ref={mergeRefs(scrollRef, ref)}
      aria-labelledby={caption ? captionId : undefined}
      tableProps={{
        "aria-busy": loading || undefined,
        "aria-rowcount": windowed && state === "rows" ? presentedRows.length + headRows : undefined,
      }}
      layout={windowed ? "fixed" : "auto"}
      classNames={{ table: classNames?.table }}
      data-scrolled-inline={scrolledInline || undefined}
      onScroll={composeEventHandlers(onScroll, trackScroll)}
      onFocusCapture={composeEventHandlers(onFocusCapture, (event: FocusEvent<HTMLDivElement>) => {
        focusInBar.current = event.target instanceof Element && event.target.closest("[data-table-bulk]") !== null;
      })}
      footer={footer}
      {...tableRest}
    >
      {caption && <Table.Caption id={captionId}>{caption}</Table.Caption>}
      {header}
      <Table.Body>{body}</Table.Body>
    </Table>
  );
}

/**
 * Holds the scroll height of the rows outside the window. No chrome, no
 * semantics, and no cell: a cell spanning every column would also span the
 * ones a narrow container drops, and those spanned columns would come back as
 * empty width.
 */
function Spacer({ height }: { height: number }) {
  return <tr aria-hidden style={{ blockSize: height }} />;
}

/**
 * A table driven by a column definition: sorting (controlled or not), row
 * selection with a select-all checkbox and a bulk-action bar, row actions,
 * expandable detail rows, a columns menu, resizable and sticky columns, column
 * filters, pagination, and designed loading (skeleton rows), empty and error
 * states, all under one header.
 *
 * Columns declare `numeric` (end-aligned, tabular, never truncated) and a
 * `priority` that drops them when the table's container narrows. Every piece
 * of state (sort, selection, expansion, shown columns, widths, filters, page,
 * page size) is controlled or not, independently; a server takes over with
 * `manualSorting`, `manualFiltering` and `manualPagination` + `rowCount`.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  return <DataTableView {...props} />;
}
