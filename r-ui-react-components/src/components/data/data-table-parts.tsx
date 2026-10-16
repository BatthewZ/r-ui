"use client";
import { ChevronRight, Columns3, FilterX } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, type Ref, useId, useRef, useState } from "react";

import { formatNumber } from "../../util/format";
import { isRtl } from "../../util/direction";
import { cn } from "../../util/style";
import { Input, Select } from "../form";
import { Pagination } from "../navigation";
import { DropdownMenu } from "../overlays";
import { Button, IconButton } from "../primitives";
import { columnName, type DataTableColumn, type DataTableFilters, isFilterActive } from "./data-table-model";
import type { DataTableLabels } from "./DataTable";

/** The row's disclosure button: a chevron that turns down when its detail row is open. */
export function DetailToggle({
  expanded,
  controls,
  label,
  onToggle,
}: {
  expanded: boolean;
  controls: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <IconButton
      label={label}
      aria-expanded={expanded}
      // Only while the detail row exists: an IDREF must name an element.
      aria-controls={expanded ? controls : undefined}
      onClick={onToggle}
      data-print="hide"
      icon={
        <ChevronRight
          className={cn(
            "size-icon transition-transform duration-normal ease-standard rtl:-scale-x-100",
            expanded && "rotate-90 rtl:-rotate-90",
          )}
        />
      }
    />
  );
}

/** The head's columns menu: one checkbox per column; a required column, and the last one shown, cannot be unchecked. */
export function ColumnsMenu<Row>({
  columns,
  isShown,
  onToggle,
  labels,
}: {
  columns: readonly DataTableColumn<Row>[];
  isShown: (column: DataTableColumn<Row>) => boolean;
  onToggle: (id: string, shown: boolean) => void;
  labels: DataTableLabels;
}) {
  const shownCount = columns.filter(isShown).length;
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenu.Trigger asChild>
        <IconButton label={labels.columns} icon={<Columns3 className="size-icon" />} data-print="hide" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {columns.map((column) => {
          const shown = isShown(column);
          return (
            <DropdownMenu.CheckboxItem
              key={column.id}
              checked={shown}
              disabled={column.required || (shown && shownCount === 1)}
              onCheckedChange={(next) => onToggle(column.id, next)}
            >
              {columnName(column)}
            </DropdownMenu.CheckboxItem>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/**
 * A column's resize handle: a focusable vertical separator on the header's
 * inline-end edge (the APG window-splitter pattern). Drag it, or use the
 * arrows (mirrored in RTL), Home (narrowest) and End (widest); a double click
 * gives the column back its automatic width. The value is the width in px.
 */
export function ColumnResizeHandle({
  label,
  width,
  min,
  max,
  start,
  onResize,
  onReset,
}: {
  label: string;
  /** The column's width as set, or as drawn when nothing set it. */
  width: number | undefined;
  min: number;
  max: number;
  /** The drawn width and fresh bounds when a gesture starts (density may have moved since the last read). */
  start: () => { width: number; min: number; max: number; step: number };
  onResize: (width: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ x: number; width: number; min: number; max: number; rtl: boolean } | null>(null);
  const [resizing, setResizing] = useState(false);
  const clamp = (w: number, lo: number, hi: number) => Math.round(Math.min(Math.max(w, lo), hi > lo ? hi : Number.POSITIVE_INFINITY));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const s = start();
    drag.current = { x: event.clientX, width: s.width, min: s.min, max: s.max, rtl: isRtl(event.currentTarget) };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    setResizing(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = (event.clientX - d.x) * (d.rtl ? -1 : 1);
    onResize(clamp(d.width + delta, d.min, d.max));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setResizing(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const s = start();
    const from = width ?? s.width;
    const by = Math.max(1, s.step);
    const grow = (event.key === "ArrowRight") !== isRtl(event.currentTarget);
    let next: number;
    if (event.key === "Home") next = s.min;
    else if (event.key === "End") next = s.max > s.min ? s.max : from;
    else next = from + (grow ? by : -by);
    onResize(clamp(next, s.min, s.max));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width === undefined ? undefined : Math.round(width)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={max > min ? Math.round(max) : undefined}
      tabIndex={0}
      data-resizing={resizing || undefined}
      data-print="hide"
      className="r-data-table-resize focus-visible:focus-ring-inset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    />
  );
}

/** A column's filter control: a text field, a select with "All", or the caller's own. */
export function FilterControl<Row>({
  column,
  value,
  onValueChange,
  labels,
}: {
  column: DataTableColumn<Row>;
  value: unknown;
  onValueChange: (value: unknown) => void;
  labels: DataTableLabels;
}) {
  const filter = column.filter;
  if (!filter) return null;
  const label = labels.filterColumn(columnName(column));
  let control: ReactNode;
  if (filter.type === "text") {
    control = (
      <Input
        aria-label={label}
        value={typeof value === "string" ? value : ""}
        placeholder={filter.placeholder}
        onChange={(event) => onValueChange(event.target.value)}
      />
    );
  } else if (filter.type === "select") {
    control = (
      <Select aria-label={label} value={typeof value === "string" ? value : ""} onValueChange={onValueChange}>
        <option value="">{labels.filterAll}</option>
        {filter.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  } else {
    control = filter.render({ value, onValueChange, label });
  }
  // Zero wide to the table's column sizing, then as wide as its cell: a
  // control's intrinsic width must never widen an auto-layout column.
  return <div className="w-0 min-w-full">{control}</div>;
}

/** The filter row's clear-all: stays focusable while there is nothing to clear, so focus is not dropped after a clear. */
export function ClearFiltersButton<Row>({
  columns,
  filters,
  onClear,
  labels,
}: {
  columns: readonly DataTableColumn<Row>[];
  filters: DataTableFilters;
  onClear: () => void;
  labels: DataTableLabels;
}) {
  const active = columns.some((c) => c.filter !== undefined && isFilterActive(filters[c.id]));
  return (
    <IconButton
      label={labels.clearFilters}
      icon={<FilterX className="size-icon" />}
      aria-disabled={!active || undefined}
      onClick={active ? onClear : undefined}
    />
  );
}

/**
 * The selection's bar: the count, the caller's actions and "Clear selection".
 * The count is spoken through a status that is mounted before the bar appears
 * (a live region inserted with its text is often not read); the bar's own copy
 * is hidden from the accessibility tree so it is not read twice.
 */
export function BulkBar({
  count,
  actions,
  onClear,
  labels,
  className,
  ref,
}: {
  count: number;
  actions: ReactNode;
  onClear: () => void;
  labels: DataTableLabels;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <>
      <span role="status" className="sr-only">
        {count > 0 ? labels.selectedCount(count) : ""}
      </span>
      {count > 0 && (
        <div
          ref={ref}
          role="group"
          aria-label={labels.bulkActions}
          data-table-bulk=""
          className={cn(
            "flex flex-wrap items-center gap-x-r3 gap-y-r5 border-t border-border bg-surface-1 px-r3 py-r5",
            className,
          )}
        >
          <span aria-hidden className="text-body-2 font-medium text-fg-primary">
            {labels.selectedCount(count)}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-r5">{actions}</div>
          <Button variant="ghost" className="ms-auto" onClick={onClear}>
            {labels.clearSelection}
          </Button>
        </div>
      )}
    </>
  );
}

/** Rows per page, the range shown ("11–20 of 48", announced politely) and the pages. */
export function PaginationBar({
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
  from,
  to,
  total,
  onPageChange,
  onPageSizeChange,
  labels,
  locale,
  ruled,
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  labels: DataTableLabels;
  locale: string | undefined;
  /** Draw the rule above it (a boxed table, whose last row has none). */
  ruled: boolean;
  className?: string;
}) {
  const id = useId();
  const sizes = [...new Set([...pageSizeOptions, pageSize])].sort((a, b) => a - b);
  return (
    <div
      data-table-pagination=""
      className={cn(
        "flex flex-wrap items-center gap-x-r2 gap-y-r5 px-r3 py-r5",
        ruled && "border-t border-border",
        className,
      )}
    >
      <div className="flex items-center gap-r4">
        <label htmlFor={id} className="whitespace-nowrap text-body-2 text-fg-secondary">
          {labels.rowsPerPage}
        </label>
        <Select id={id} className="w-auto" value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          {sizes.map((n) => (
            <option key={n} value={String(n)}>
              {formatNumber(n, { locale })}
            </option>
          ))}
        </Select>
      </div>
      <span aria-live="polite" className="text-body-2 text-fg-secondary">
        {labels.pageRange(from, to, total)}
      </span>
      {/* Pagination is a size container (no width of its own): it takes the rest of the
          row and sits at its end. */}
      <Pagination className="min-w-0 grow basis-column-sm" classNames={{ row: "justify-end" }} page={page} pageCount={pageCount} onPageChange={onPageChange} />
    </div>
  );
}
