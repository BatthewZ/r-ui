"use client";
import type { CSSProperties } from "react";

import { cn } from "../../util/style";
import { type DataTableProps, DataTableView } from "./DataTable";

export interface VirtualizedTableProps<Row> extends DataTableProps<Row> {
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
 * Select-all spans the whole dataset, not the mounted window. The table
 * carries `aria-rowcount` and each row its `aria-rowindex`.
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
