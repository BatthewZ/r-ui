"use client";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  useContext,
} from "react";

import { cn, type SlotClassNames } from "../../util/style";

/**
 * How much box the table draws.
 * - `boxed`: a hairline frame, a filled head band, a rule between rows.
 * - `rules`: no frame or band; a rule under the head and between rows. For a
 *   table inside a card (a boxed one there reads as two concentric frames).
 * - `plain`: no rules at all; rows separate by height alone.
 */
export type TableVariant = "boxed" | "rules" | "plain";

/**
 * How essential a column is when its table's CONTAINER gets narrow. 1 never
 * drops; 2 drops below 24rem, 3 below 32rem, 4 below 42rem, 5 below 48rem of
 * the table's own width (never the viewport's). Give every cell of a column
 * the same priority as its header.
 */
export type ColumnPriority = 1 | 2 | 3 | 4 | 5;

export type SortDirection = "asc" | "desc";

/**
 * How column widths are decided.
 * - `auto`: numeric and `truncate={false}` columns shrink to their content;
 *   `wrap` columns take their content's width up to what is free and wrap
 *   past it; the truncating text columns share the rest equally and ellipsize
 *   when squeezed. Widen one with a width class on its header.
 * - `fixed`: widths come from the header cells (`style`/`className`), unset
 *   columns share the rest, and every cell clips. Content can never move a
 *   column, which a virtual window needs.
 */
export type TableLayout = "auto" | "fixed";

interface TableContextValue {
  variant: TableVariant;
  layout: TableLayout;
  striped: boolean;
  stickyHeader: boolean;
}

const TableContext = createContext<TableContextValue>({
  variant: "rules",
  layout: "auto",
  striped: false,
  stickyHeader: false,
});

/** Whether a row sits in the head (no band, no hover wash) or the body. */
const SectionContext = createContext<"head" | "body">("body");

/* Literal class strings, one per priority, so Tailwind's scanner generates them.
   `/table` names the container the root declares, so a column drops by the
   width of ITS table even inside another container. `w-0` as well: a fixed
   layout keeps a hidden header's width reserved, so a dropped column with a
   width would leave a hole; `min-w-0` because a set width is also a minimum. */
const PRIORITY_CLASS: Record<ColumnPriority, string> = {
  1: "",
  2: "@max-sm/table:hidden @max-sm/table:w-0 @max-sm/table:min-w-0",
  3: "@max-lg/table:hidden @max-lg/table:w-0 @max-lg/table:min-w-0",
  4: "@max-2xl/table:hidden @max-2xl/table:w-0 @max-2xl/table:min-w-0",
  5: "@max-3xl/table:hidden @max-3xl/table:w-0 @max-3xl/table:min-w-0",
};

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

export interface TableProps extends HTMLAttributes<HTMLDivElement> {
  variant?: TableVariant;
  layout?: TableLayout;
  /** Band every other body row. A row's parity comes from its `index` when given. */
  striped?: boolean;
  /**
   * Pin the head while the table's own scroll area scrolls. That area is the
   * root element, so bound its height (`className="max-h-…"`) or there is
   * nothing to scroll past the head.
   */
  stickyHeader?: boolean;
  /** Props for the `<table>` element itself (`aria-rowcount`, `aria-busy`…). */
  tableProps?: TableHTMLAttributes<HTMLTableElement>;
  /** Content after the `<table>`, inside the scroll area: a bar that sticks to its bottom edge. */
  footer?: ReactNode;
  classNames?: SlotClassNames<"table">;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A semantic `<table>` in a scroll area that is also the size container its
 * columns drop against. `aria-label` / `aria-labelledby` / `aria-describedby`
 * given here land on the `<table>`, where they name the table; every other
 * prop lands on the root.
 */
function TableRoot({
  variant = "boxed",
  layout = "auto",
  striped = false,
  stickyHeader = false,
  tableProps,
  footer,
  classNames,
  className,
  children,
  ref,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: TableProps) {
  return (
    <TableContext.Provider value={{ variant, layout, striped, stickyHeader }}>
      <div
        ref={ref}
        data-variant={variant}
        className={cn(
          // `relative`: the root is a scrollport, so absolutely positioned
          // descendants (sr-only text) must resolve inside it, not down the page.
          // `isolate`: its layers (a pinned head over pinned columns) rank within
          // it, never against the page's sticky chrome it scrolls under.
          "@container/table relative isolate min-w-0 overflow-auto",
          variant === "boxed" && "rounded-lg border border-border bg-surface-0",
          className,
        )}
        {...rest}
      >
        <table
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          {...tableProps}
          className={cn(
            // Separate borders: a collapsed border is painted by the TABLE, so a
            // sticky head would scroll away from its own rule.
            "w-full border-separate border-spacing-0 text-body-2 text-fg-primary",
            layout === "fixed" && "table-fixed",
            tableProps?.className,
            classNames?.table,
          )}
        >
          {children}
        </table>
        {footer}
      </div>
    </TableContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Caption                                                            */
/* ------------------------------------------------------------------ */

export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {
  /** Keep the caption as the table's accessible name without showing it. */
  visuallyHidden?: boolean;
  ref?: Ref<HTMLTableCaptionElement>;
}

function TableCaption({ visuallyHidden = false, className, ref, ...rest }: TableCaptionProps) {
  return (
    <caption
      ref={ref}
      className={cn(
        visuallyHidden ? "sr-only" : "caption-top pb-r4 text-start text-body-2 text-fg-secondary",
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Head / Body                                                        */
/* ------------------------------------------------------------------ */

export interface TableSectionProps extends HTMLAttributes<HTMLTableSectionElement> {
  ref?: Ref<HTMLTableSectionElement>;
}

function TableHead({ className, ref, ...rest }: TableSectionProps) {
  const { stickyHeader } = useContext(TableContext);
  return (
    <SectionContext.Provider value="head">
      <thead
        ref={ref}
        data-sticky={stickyHeader || undefined}
        className={cn(stickyHeader && "sticky top-0 z-raised", className)}
        {...rest}
      />
    </SectionContext.Provider>
  );
}

function TableBody({ className, ref, ...rest }: TableSectionProps) {
  return <tbody ref={ref} className={className} {...rest} />;
}

/* ------------------------------------------------------------------ */
/*  Row                                                                */
/* ------------------------------------------------------------------ */

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /**
   * Selected state. Leave it undefined in a table without selection: passing
   * it (even `false`) publishes `aria-selected`, which claims rows are selectable.
   */
  selected?: boolean;
  /**
   * The row's position in the DATA, from 0. Decides its stripe when the DOM
   * order is not the data order (a virtual window, a spacer row between).
   */
  index?: number;
  ref?: Ref<HTMLTableRowElement>;
}

function TableRow({ selected, index, className, ref, ...rest }: TableRowProps) {
  const { striped } = useContext(TableContext);
  const inBody = useContext(SectionContext) === "body";
  const banded = inBody && striped && index !== undefined && index % 2 === 1;
  const band = inBody && striped && (index === undefined ? "even:bg-surface-1" : banded && "bg-surface-1");
  return (
    <tr
      ref={ref}
      data-table-row=""
      aria-selected={selected}
      data-selected={selected || undefined}
      // Named for a stylesheet that repaints the band (a sticky cell's opaque fill).
      data-band={banded ? "" : undefined}
      className={cn(
        // Height lives on the ROW (cells carry no block padding), so a row is
        // exactly --ROW-H: what a virtual window's arithmetic relies on.
        "h-row",
        band,
        inBody && "hover:bg-fg-primary/5",
        // The selection wash comes after the band so a selected banded row
        // takes it; the leading marker (styles.css) is the real cue.
        selected && "bg-accent/10 hover:bg-accent/15",
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Cells                                                              */
/* ------------------------------------------------------------------ */

/** Classes shared by header and body cells. */
function cellClasses({
  variant,
  layout,
  numeric,
  truncate,
  wrap,
  priority,
}: {
  variant: TableVariant;
  layout: TableLayout;
  numeric: boolean;
  truncate: boolean;
  wrap: boolean;
  priority: ColumnPriority;
}) {
  let sizing: string;
  // Wrapped text grows the row past --ROW-H; the padding keeps lines off the rules.
  if (wrap) sizing = "whitespace-normal break-words py-r5";
  else if (layout === "fixed") sizing = "truncate";
  // `w-0` + nowrap: the column takes exactly its content's width.
  else if (numeric || !truncate) sizing = "w-0 whitespace-nowrap";
  // `max-w-0` zeroes the cell's intrinsic width, so the column takes a share of
  // what is left instead of widening the table, and ellipsizes inside it.
  else sizing = "max-w-0 truncate";
  return cn(
    // `*:align-middle`: an inline-flex child (a status, a meter) would sit on
    // its icon's synthesized baseline, a few px high, otherwise.
    "px-r3 py-0 align-middle *:align-middle first:ps-r2 last:pe-r2",
    variant !== "plain" && "border-b border-border",
    variant === "boxed" && "[tr:last-child>&]:border-b-0",
    sizing,
    numeric && "text-end tabular-nums",
    PRIORITY_CLASS[priority],
  );
}

/** A one-line cell's full value, so truncation never hides data. */
function textTitle(children: ReactNode): string | undefined {
  return typeof children === "string" || typeof children === "number" ? String(children) : undefined;
}

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** End-aligned and tabular; sized to its content (auto layout), so never truncated there. */
  numeric?: boolean;
  priority?: ColumnPriority;
  /** One line with an ellipsis (default). `false` lets the content set the width. */
  truncate?: boolean;
  /** Text wraps onto more lines and the row grows to fit (prose-like values, a pricing grid). Wins over `truncate`. */
  wrap?: boolean;
  /** The column's current sort. Sets `aria-sort` on this header. */
  sort?: SortDirection | null;
  /** Makes the header a sort button. The caller owns the order. */
  onSort?: () => void;
  /** Rendered after the content, outside the sort button: a resize handle. */
  after?: ReactNode;
  classNames?: SlotClassNames<"button" | "icon">;
  ref?: Ref<HTMLTableCellElement>;
}

function TableHeaderCell({
  numeric = false,
  priority = 1,
  truncate = true,
  wrap = false,
  sort = null,
  onSort,
  after,
  scope = "col",
  classNames,
  className,
  children,
  title,
  ref,
  ...rest
}: TableHeaderCellProps) {
  const { variant, layout, stickyHeader } = useContext(TableContext);
  const pinnedHead = useContext(SectionContext) === "head" && stickyHeader;
  const SortIcon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      ref={ref}
      scope={scope}
      // Only the sorted column carries `aria-sort` (one at a time, per APG).
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
      title={title ?? (wrap ? undefined : textTitle(children))}
      className={cn(
        cellClasses({ variant, layout, numeric, truncate, wrap, priority }),
        "text-start text-body-3 font-semibold text-fg-secondary",
        numeric && "text-end",
        // An opaque band: a pinned head floats over rows that keep painting. A body
        // row header is not in the pinned head and keeps the row's own paint.
        (variant === "boxed" || pinnedHead) && "bg-surface-1",
        variant === "plain" && pinnedHead && "border-b border-border",
        className,
      )}
      {...rest}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "group/sort inline-flex min-h-hit max-w-full items-center gap-r6 rounded-sm align-middle",
            "font-semibold text-fg-secondary hover:text-fg-primary",
            numeric && "flex-row-reverse",
            classNames?.button,
          )}
        >
          <span className="min-w-0 truncate">{children}</span>
          <SortIcon
            aria-hidden
            className={cn(
              "size-icon shrink-0",
              // Unsorted: shown on hover/focus only (and always on touch, which
              // has no hover), so a row of headers is not a row of glyphs.
              sort
                ? "text-fg-primary"
                : "text-fg-muted opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100 pointer-coarse:opacity-100",
              classNames?.icon,
            )}
          />
        </button>
      ) : (
        children
      )}
      {after}
    </th>
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  priority?: ColumnPriority;
  /** One line with an ellipsis (default); the full text becomes `title`. */
  truncate?: boolean;
  /** Text wraps onto more lines and the row grows to fit. Wins over `truncate`. Not for a `VirtualizedTable`, whose rows must stay one `--ROW-H`. */
  wrap?: boolean;
  ref?: Ref<HTMLTableCellElement>;
}

function TableCell({
  numeric = false,
  priority = 1,
  truncate = true,
  wrap = false,
  className,
  children,
  title,
  ref,
  ...rest
}: TableCellProps) {
  const { variant, layout } = useContext(TableContext);
  return (
    <td
      ref={ref}
      title={title ?? (truncate && !wrap ? textTitle(children) : undefined)}
      className={cn(cellClasses({ variant, layout, numeric, truncate, wrap, priority }), className)}
      {...rest}
    >
      {children}
    </td>
  );
}

/**
 * Compound table: `Table`, `Table.Caption`, `Table.Head`, `Table.Body`,
 * `Table.Row`, `Table.HeaderCell`, `Table.Cell`.
 *
 * Rows are `--ROW-H` tall and cells one line, truncated with the full value
 * in `title` (or `truncate={false}`: one line at its content's width, or
 * `wrap`: several lines, and the row grows). Columns declare a `priority` and drop when the TABLE's
 * container narrows. A sortable header is a real `<button>` inside the `<th>`;
 * the sorted header carries `aria-sort`. A selected row gets a wash and a
 * leading accent marker.
 */
export const Table = Object.assign(TableRoot, {
  Caption: TableCaption,
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  HeaderCell: TableHeaderCell,
  Cell: TableCell,
});
