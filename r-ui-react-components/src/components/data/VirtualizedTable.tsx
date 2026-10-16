"use client";
import type { CSSProperties } from "react";

import { cn } from "../../util/style";
import { type DataTableProps, DataTableView } from "./DataTable";

/**
 * What a virtual window cannot hold: a detail row breaks the one-`--ROW-H`
 * arithmetic the window is built on, and pages are what the window replaces.
 */
type WindowedOut =
  | "renderDetail"
  | "expandedKeys"
  | "defaultExpandedKeys"
  | "onExpandedKeysChange"
  | "pageSize"
  | "defaultPageSize"
  | "onPageSizeChange"
  | "pageSizeOptions"
  | "page"
  | "defaultPage"
  | "onPageChange"
  | "manualPagination"
  | "rowCount";

export interface VirtualizedTableProps<Row> extends Omit<DataTableProps<Row>, WindowedOut> {
  /**
   * How many rows the viewport shows; its height is that many `--ROW-H` plus
   * the head, so it follows density and input. A height in `className` wins.
   */
  visibleRows?: number;
  /** Rows mounted beyond each edge of the viewport. */
  overscan?: number;
}

/**
 * `DataTable` for 10k+ rows: only the rows in view (plus `overscan`) are
 * mounted, between two spacer rows that keep the scrollbar true.
 *
 * Row height is not a prop. It is the real `--ROW-H`, read from the scroll
 * area in px and re-read whenever it resolves differently there, for any
 * reason (density, input, theme, a stylesheet change): a hidden probe of
 * `height: var(--ROW-H)` is watched by a ResizeObserver. Every cell is one
 * truncated line and the layout is fixed, so a row is exactly that tall and
 * the window arithmetic is exact. Columns size by their `width`; the rest
 * share what is left.
 *
 * Select-all spans every row that passes the filters, not the mounted window.
 * The table carries `aria-rowcount` and each row its `aria-rowindex` (a filter
 * row is the head's second row). Column filters, the columns menu, resizable
 * and sticky columns and the bulk bar work as in `DataTable`; a filter row
 * takes a row of the viewport's height. Expandable rows and pages do not
 * exist here: a detail row would break the fixed row height the window's
 * arithmetic needs, and the window is the alternative to pages.
 */
export function VirtualizedTable<Row>({
  visibleRows = 12,
  overscan = 8,
  stickyHeader = true,
  className,
  style,
  ...props
}: VirtualizedTableProps<Row>) {
  return (
    <DataTableView
      {...props}
      stickyHeader={stickyHeader}
      windowed={{ visibleRows, overscan }}
      style={{ "--visible-rows": visibleRows, ...style } as CSSProperties}
      // Rows + 1 for the head, as CONTENT height (a boxed frame adds its
      // hairlines outside it), so the viewport ends on a row boundary. A
      // caller's `h-*` replaces it.
      className={cn("box-content h-[calc(var(--ROW-H)*(var(--visible-rows)+1))] overscroll-contain", className)}
    />
  );
}
