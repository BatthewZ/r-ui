"use client";
import { Inbox, TriangleAlert } from "lucide-react";
import { type CSSProperties, type ReactNode, useId, useMemo, useRef } from "react";

import { useVirtualRows } from "../../hooks/use-virtual-rows";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { Checkbox } from "../form";
import { Skeleton } from "../primitives";
import {
  type DataTableColumn,
  defaultCellText,
  isSortable,
  nextSort,
  type RowKey,
  type SelectionParams,
  type SortParams,
  sortRows,
  useSelection,
  useSort,
} from "./data-table-model";
import { EmptyState } from "./EmptyState";
import { Table, type TableProps } from "./Table";
import { useRowHeight } from "./use-row-height";

export interface DataTableProps<Row>
  extends SortParams,
    SelectionParams,
    Omit<TableProps, "children" | "classNames" | "tableProps"> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** A stable key per row: selection and React reconciliation both use it. */
  getRowKey: (row: Row, index: number) => RowKey;
  /**
   * The rows arrive already in `sort` order (a server sorts them). The table
   * still shows and reports the sort; it never reorders.
   */
  manualSorting?: boolean;
  /** Adds a checkbox column with a select-all header (over every row). */
  selectable?: boolean;
  /** The accessible name of a row's checkbox. Default: "Select " + the first column's text. */
  getRowLabel?: (row: Row) => string;
  selectAllLabel?: string;
  /** Per-row trailing actions (icon buttons, a menu). */
  rowActions?: (row: Row) => ReactNode;
  /** Header text for the actions column, read by screen readers only. */
  rowActionsLabel?: string;
  /** Show skeleton rows (the head stays) and mark the table busy. */
  loading?: boolean;
  /** How many skeleton rows to draw while loading. */
  loadingRows?: number;
  loadingLabel?: string;
  /** A failure message. Shown instead of rows, with `errorActions` (a retry). */
  error?: ReactNode;
  errorActions?: ReactNode;
  /** What an empty table shows. Default: a quiet "No data" state. */
  empty?: ReactNode;
  /** A visible caption naming the table (or pass `aria-label`). */
  caption?: ReactNode;
  classNames?: SlotClassNames<"table" | "row" | "headerCell" | "cell" | "empty">;
}

/** Internal: VirtualizedTable reuses everything here and windows the body. */
interface ViewProps<Row> extends DataTableProps<Row> {
  windowed?: { visibleRows: number; overscan: number };
}

/** Fixed layout only: sized to the checkbox's hit floor plus cell padding, so it cannot clip. */
const CONTROL_COLUMN = "w-[calc(var(--HIT-MIN)+var(--R-SIZE-3)*2)]";
const ACTIONS_COLUMN = "w-[calc(var(--CONTROL-H)+var(--R-SIZE-3)*2)]";

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
  selectAllLabel = "Select all rows",
  rowActions,
  rowActionsLabel = "Actions",
  loading = false,
  loadingRows = 5,
  loadingLabel = "Loading",
  error,
  errorActions,
  empty,
  caption,
  classNames,
  windowed,
  ref,
  ...tableRest
}: ViewProps<Row>) {
  const [sort, setSort] = useSort({ sort: sortProp, defaultSort, onSortChange });
  const ordered = useMemo(
    () => (manualSorting ? rows : sortRows(rows, columns, sort)),
    [manualSorting, rows, columns, sort],
  );
  const keys = useMemo(() => ordered.map((row, i) => getRowKey(row, i)), [ordered, getRowKey]);
  const selection = useSelection(keys, { selectedKeys, defaultSelectedKeys, onSelectedKeysChange });

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = useRowHeight(scrollRef, 40, Boolean(windowed));
  const visibleRows = windowed?.visibleRows ?? 0;
  const virtual = useVirtualRows({
    rowCount: windowed ? ordered.length : 0,
    rowHeight,
    overscan: windowed?.overscan ?? 0,
    scrollRef,
    initialViewport: rowHeight * visibleRows,
  });

  const captionId = useId();
  const columnCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const state: "loading" | "error" | "empty" | "rows" = loading
    ? "loading"
    : error
      ? "error"
      : ordered.length === 0
        ? "empty"
        : "rows";

  const rowLabel = (row: Row) => {
    if (getRowLabel) return getRowLabel(row);
    const first = columns[0];
    return first ? `Select ${defaultCellText(first, row)}` : "Select row";
  };

  const start = windowed ? virtual.startIndex : 0;
  const end = windowed ? virtual.endIndex : ordered.length;
  const padTop = windowed ? virtual.paddingTop : 0;
  const padBottom = windowed ? virtual.paddingBottom : 0;

  const header = (
    <Table.Head>
      <Table.Row aria-rowindex={windowed ? 1 : undefined}>
        {selectable && (
          // Auto layout shrinks the column to the box (its hit area overflows
          // the cell); fixed layout needs the width said out loud.
          <Table.HeaderCell truncate={false} className={cn(windowed && CONTROL_COLUMN, classNames?.headerCell)}>
            <Checkbox
              aria-label={selectAllLabel}
              checked={selection.all}
              indeterminate={selection.some}
              disabled={state !== "rows"}
              onCheckedChange={() => selection.toggleAll(!selection.all)}
            />
          </Table.HeaderCell>
        )}
        {columns.map((column) => {
          const sortable = isSortable(column);
          const active = sort?.column === column.id ? sort.direction : null;
          return (
            <Table.HeaderCell
              key={column.id}
              numeric={column.numeric}
              priority={column.priority}
              truncate={column.truncate}
              sort={active}
              onSort={sortable ? () => setSort(nextSort(column, sort)) : undefined}
              // Through a custom property and classes, not an inline width: a
              // dropped column must give its width back (the priority class
              // zeroes it), and an inline style would outrank that. `max-w` too,
              // or a truncating header's own `max-w-0` caps the width.
              style={column.width ? ({ "--col-w": column.width } as CSSProperties) : undefined}
              className={cn(column.width && "w-(--col-w) max-w-(--col-w)", classNames?.headerCell)}
            >
              {column.header}
            </Table.HeaderCell>
          );
        })}
        {rowActions && (
          <Table.HeaderCell truncate={false} className={cn(windowed && ACTIONS_COLUMN, classNames?.headerCell)}>
            <span className="sr-only">{rowActionsLabel}</span>
          </Table.HeaderCell>
        )}
      </Table.Row>
    </Table.Head>
  );

  let body: ReactNode;
  if (state === "loading") {
    body = Array.from({ length: loadingRows }, (_, i) => (
      <Table.Row key={i} aria-hidden={i > 0 || undefined}>
        {selectable && <Table.Cell truncate={false} />}
        {columns.map((column, c) => (
          <Table.Cell key={column.id} numeric={column.numeric} priority={column.priority}>
            {i === 0 && c === 0 && <span className="sr-only">{loadingLabel}</span>}
            <Skeleton
              shape="block"
              className={cn("inline-block h-r3 rounded-sm align-middle", column.numeric ? "w-1/2" : c === 0 ? "w-3/4" : "w-2/3")}
            />
          </Table.Cell>
        ))}
        {rowActions && <Table.Cell truncate={false} />}
      </Table.Row>
    ));
  } else if (state === "error" || state === "empty") {
    body = (
      <Table.Row>
        <Table.Cell colSpan={columnCount} truncate={false} className={cn("whitespace-normal", classNames?.empty)}>
          {state === "error" ? (
            <EmptyState role="alert" tone="error" icon={<TriangleAlert />} title={error} actions={errorActions} />
          ) : (
            (empty ?? <EmptyState icon={<Inbox />} title="No data" />)
          )}
        </Table.Cell>
      </Table.Row>
    );
  } else {
    body = (
      <>
        {windowed && padTop > 0 && <Spacer height={padTop} />}
        {ordered.slice(start, end).map((row, offset) => {
          const index = start + offset;
          const key = keys[index] as RowKey;
          const isSelected = selectable ? selection.selected.has(key) : undefined;
          return (
            <Table.Row
              key={key}
              index={index}
              selected={isSelected}
              aria-rowindex={windowed ? index + 2 : undefined}
              className={classNames?.row}
            >
              {selectable && (
                <Table.Cell truncate={false} className={classNames?.cell}>
                  <Checkbox
                    aria-label={rowLabel(row)}
                    checked={isSelected}
                    onCheckedChange={(on: boolean) => selection.toggle(key, on)}
                  />
                </Table.Cell>
              )}
              {columns.map((column) => {
                const text = column.cell ? undefined : defaultCellText(column, row);
                return (
                  <Table.Cell
                    key={column.id}
                    numeric={column.numeric}
                    priority={column.priority}
                    truncate={column.truncate}
                    title={column.title?.(row) ?? text}
                    className={classNames?.cell}
                  >
                    {column.cell ? column.cell(row) : text}
                  </Table.Cell>
                );
              })}
              {rowActions && (
                <Table.Cell truncate={false} className={cn("text-end", classNames?.cell)}>
                  {rowActions(row)}
                </Table.Cell>
              )}
            </Table.Row>
          );
        })}
        {windowed && padBottom > 0 && <Spacer height={padBottom} />}
      </>
    );
  }

  return (
    <Table
      ref={mergeRefs(scrollRef, ref)}
      aria-labelledby={caption ? captionId : undefined}
      tableProps={{
        "aria-busy": loading || undefined,
        "aria-rowcount": windowed && state === "rows" ? ordered.length + 1 : undefined,
      }}
      layout={windowed ? "fixed" : "auto"}
      classNames={{ table: classNames?.table }}
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
 * A table driven by a column definition: sorting (controlled or not),
 * row selection with a select-all checkbox, row actions, and designed
 * loading (skeleton rows), empty and error states, all under one header.
 *
 * Columns declare `numeric` (end-aligned, tabular, never truncated) and a
 * `priority` that drops them when the table's container narrows.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  return <DataTableView {...props} />;
}
