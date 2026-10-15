"use client";
import {
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Table } from "../data";
import { useClickOutside } from "../../hooks/use-click-outside";
import { type Placement, useFloating } from "../../hooks/use-floating";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { topLayerExit, useExitPresence } from "../overlays/internal";
import { Button } from "../primitives";
import type { ChartNotes, ChartTable, SeriesShape, SeriesSlot } from "./chart-model";
import { markPath, STROKED_SHAPES } from "./chart-plan";

/* ------------------------------------------------------------------ */
/*  Words                                                              */
/* ------------------------------------------------------------------ */

/** Every string a chart writes itself, for translation. */
export interface ChartLabels {
  showTable: string;
  showChart: string;
  /** Shown in place of the plot when there are no rows at all. */
  noData: string;
  /** Shown above the table when there are rows but nothing can be drawn. */
  cannotDraw: string;
  /** Spoken with the focusable plot. */
  keyboardHint: string;
  /** The table's first column header. Empty: "Time" on a time axis, else nothing. */
  corner: string;
  /** The stacked bar readout's sum row. */
  total: string;
  rowsCapped: (shown: number, total: number) => string;
  seriesCapped: (drawn: number, total: number, tabulated: number) => string;
  valuesDropped: (count: number) => string;
  gridCapped: (rows: number, totalRows: number, columns: number, totalColumns: number) => string;
}

export const DEFAULT_CHART_LABELS: ChartLabels = {
  showTable: "Show as table",
  showChart: "Show chart",
  noData: "No data",
  cannotDraw: "Nothing to draw: every value is missing or unplaceable. The table lists what there is.",
  keyboardHint: "Use the arrow keys to read the values; Home and End jump to the ends.",
  corner: "",
  total: "Total",
  rowsCapped: (shown, total) => `Showing the first ${shown.toLocaleString()} of ${total.toLocaleString()} points.`,
  seriesCapped: (drawn, total, tabulated) =>
    tabulated === total
      ? `${drawn} of ${total} series drawn (one colour each, never repeated); the table lists all ${total}.`
      : `${drawn} of ${total} series drawn; the table lists the first ${tabulated}.`,
  valuesDropped: (count) => `${count.toLocaleString()} values past the last x were left out.`,
  gridCapped: (rows, totalRows, columns, totalColumns) =>
    `Showing the first ${rows} of ${totalRows} rows and ${columns} of ${totalColumns} columns.`,
};

export function notesText(notes: ChartNotes, labels: ChartLabels): string[] {
  const out: string[] = [];
  if (notes.rowsTotal > notes.rowsShown) out.push(labels.rowsCapped(notes.rowsShown, notes.rowsTotal));
  if (notes.seriesTotal > notes.seriesDrawn) out.push(labels.seriesCapped(notes.seriesDrawn, notes.seriesTotal, notes.seriesTabulated));
  if (notes.valuesDropped > 0) out.push(labels.valuesDropped(notes.valuesDropped));
  return out;
}

/* ------------------------------------------------------------------ */
/*  Series key: colour + shape                                         */
/* ------------------------------------------------------------------ */

/* Literal strings so Tailwind's scanner sees every utility. */
export const SERIES_TEXT: Record<SeriesSlot, string> = {
  1: "text-series-1",
  2: "text-series-2",
  3: "text-series-3",
  4: "text-series-4",
  5: "text-series-5",
  6: "text-series-6",
  7: "text-series-7",
  8: "text-series-8",
};

/** A marker shape drawn in its series' colour; closed shapes fill, open ones stroke. */
export function Mark({ shape, x, y, r, className }: { shape: SeriesShape; x: number; y: number; r: number; className?: string }) {
  return (
    <path
      d={markPath(shape, x, y, r)}
      data-shape={shape}
      className={cn(STROKED_SHAPES.has(shape) ? "r-charts-mark-open" : "r-charts-mark", className)}
    />
  );
}

/** The legend's and the tooltip's key: a short line (for a line series) behind the shape. */
export function SeriesKey({ slot, shape, line }: { slot: SeriesSlot; shape: SeriesShape; line: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 12" className={cn("r-charts-key h-(--BodyText-3) w-auto shrink-0", SERIES_TEXT[slot])}>
      {line && <path d="M1 6H19" className="r-charts-key-line" />}
      <Mark shape={shape} x={10} y={6} r={3.6} />
    </svg>
  );
}

export interface LegendEntry {
  name: string;
  slot: SeriesSlot;
  shape: SeriesShape;
}

/**
 * Names beside their colour and shape. Hidden from assistive tech: the table's
 * column headers already name every series, so a legend there is the same list
 * read twice. One series needs no legend (the chart's label names it).
 */
export function ChartLegend({ entries, line, className }: { entries: LegendEntry[]; line: boolean; className?: string }) {
  if (entries.length < 2) return null;
  return (
    <ul aria-hidden data-chart-legend="" className={cn("flex flex-wrap items-center gap-x-r3 gap-y-r5 text-body-3 text-fg-secondary", className)}>
      {entries.map((entry, i) => (
        <li key={i} className="inline-flex min-w-0 max-w-full items-center gap-r6">
          <SeriesKey slot={entry.slot} shape={entry.shape} line={line} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{entry.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

function ChartTableView({ table, caption, visible, className }: { table: ChartTable; caption: string; visible: boolean; className?: string }) {
  return (
    <div data-chart-table={visible ? "visible" : "hidden"} className={cn(!visible && "sr-only")}>
      <Table
        variant="rules"
        stickyHeader={visible}
        className={cn(visible && "max-h-[calc(var(--CHART-H)*1.5)]", className)}
      >
        <Table.Caption visuallyHidden>{caption}</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell scope="col">{table.corner}</Table.HeaderCell>
            {table.columns.map((name, i) => (
              <Table.HeaderCell key={i} numeric scope="col">
                {name}
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {table.rows.map((row, i) => (
            <Table.Row key={i}>
              <Table.HeaderCell scope="row" className="font-normal">
                {row.label}
              </Table.HeaderCell>
              {row.cells.map((cell, j) => (
                <Table.Cell key={j} numeric>
                  {cell}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Frame                                                              */
/* ------------------------------------------------------------------ */

export type ChartSlots = "plot" | "legend" | "table" | "tooltip" | "notes";

export interface ChartBaseProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  /** The chart's accessible name, and its table's caption ("Requests per second, last 7 days"). */
  label: string;
  /** What a screen reader hears after the name. Default: the series, the span and the value range. */
  summary?: string;
  /** Every string the chart writes itself. */
  labels?: Partial<ChartLabels>;
  classNames?: SlotClassNames<ChartSlots>;
  ref?: Ref<HTMLElement>;
}

interface ChartFrameProps extends Omit<ChartBaseProps, "summary" | "labels"> {
  kind: string;
  summaryText: string;
  legend: ReactNode;
  notes: string[];
  table: ChartTable;
  /** Rows exist but nothing can be drawn: the table is the chart. */
  undrawable: boolean;
  /** No rows at all. */
  empty: boolean;
  /** The polite announcement of the value under the keyboard or a tap. */
  status: string;
  labelsResolved: ChartLabels;
  /** The plot, rendered only while the chart view is shown. */
  children: ReactNode;
}

/**
 * The figure every chart shares: name and summary, legend, the plot or the
 * table in its place, notes on anything a cap left out, the view toggle, and a
 * polite live region. The table is always built: visually hidden beside a
 * drawing (the accessible rendering), shown in its place when there is nothing
 * to draw, and on "Show as table".
 */
export function ChartFrame({
  kind,
  label,
  summaryText,
  legend,
  notes,
  table,
  undrawable,
  empty,
  status,
  labelsResolved: labels,
  children,
  className,
  classNames,
  ref,
  ...rest
}: ChartFrameProps) {
  const [asTable, setAsTable] = useState(false);
  const summaryId = useId();
  const showTable = asTable || undrawable;
  return (
    <figure
      ref={ref}
      data-chart={kind}
      aria-label={label}
      aria-describedby={summaryId}
      className={cn("m-0 flex min-w-0 flex-col gap-r4", className)}
      {...rest}
    >
      <p id={summaryId} className="sr-only">
        {summaryText}
      </p>
      {!showTable && !empty && legend}
      {empty ? (
        <p data-chart-empty="" className="flex min-h-chart items-center justify-center rounded-md border border-dashed text-body-2 text-fg-muted">
          {labels.noData}
        </p>
      ) : (
        <>
          {undrawable && <p className="text-body-2 text-fg-secondary">{labels.cannotDraw}</p>}
          {!showTable && children}
          <ChartTableView table={table} caption={label} visible={showTable} className={classNames?.table} />
        </>
      )}
      {(notes.length > 0 || (!undrawable && !empty)) && (
        <div className="flex flex-wrap items-center justify-between gap-r4">
          <div className={cn("min-w-0 text-body-3 text-fg-muted", classNames?.notes)}>
            {notes.map((note, i) => (
              <p key={i} data-chart-note="" className="[overflow-wrap:anywhere]">
                {note}
              </p>
            ))}
          </div>
          {!undrawable && !empty && (
            <Button variant="ghost" className="ms-auto text-body-3" onClick={() => setAsTable((v) => !v)}>
              {asTable ? labels.showChart : labels.showTable}
            </Button>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Readout (tooltip)                                                  */
/* ------------------------------------------------------------------ */

export interface ReadoutRow {
  name: string;
  value: string;
  slot: SeriesSlot | null;
  shape: SeriesShape | null;
}

/**
 * One tooltip for every series at the cursor. It renders in place, inside the
 * plot, and is promoted to the top layer (never portalled), so it inherits the
 * plot's density and is never clipped by a card. Hidden from assistive tech:
 * the live region speaks the same content once, and only for the keyboard and
 * a tap, never for a passing pointer.
 */
export function ChartReadout({
  open,
  anchor,
  title,
  rows,
  line,
  placement = "right-start",
  anchorElement,
  className,
}: {
  open: boolean;
  placement?: Placement;
  /** The cursor's box inside the plot (px from its top-left). */
  anchor: { x: number; y: number; w: number; h: number } | null;
  /** Anchor to this element instead (a heatmap's cell). `null`: none yet. */
  anchorElement?: Element | null;
  title: string;
  rows: ReadoutRow[];
  line: boolean;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const present = useExitPresence(open && (anchor !== null || !!anchorElement), panel, topLayerExit);
  const { refs, floatingStyles, update } = useFloating({ placement, offsetPx: 12, open: present });
  const last = useRef(anchor);
  if (anchor) last.current = anchor;
  const at = anchor ?? last.current;

  useLayoutEffect(() => {
    if (anchorElement) refs.setReference(anchorElement);
  }, [anchorElement, refs]);
  // The anchor moves by style, which nothing floating-ui observes.
  useLayoutEffect(() => {
    if (present) update();
  }, [present, update, anchorElement, at?.x, at?.y, at?.w, at?.h]);

  return (
    <>
      {anchorElement === undefined && (
        <span
          ref={refs.setReference}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: at?.x ?? 0, top: at?.y ?? 0, width: at?.w ?? 0, height: at?.h ?? 0 }}
        />
      )}
      {present && (
        <div
          ref={mergeRefs(panel, refs.setFloating)}
          aria-hidden
          data-chart-tooltip=""
          inert={!open}
          style={floatingStyles}
          className={cn(
            // The contract's inverse bubble, as Tooltip: `bg-fg-primary` keeps its fill and
            // its ink under forced colours, where a custom fill would be repainted.
            "r-overlays-surface pointer-events-none flex max-w-[calc(var(--MEASURE)/2)] flex-col gap-r6 rounded-sm bg-fg-primary px-r5 py-r6 text-body-2 text-fg-inverse shadow-sm",
            className,
          )}
        >
          <p className="text-body-3 [overflow-wrap:anywhere]">{title}</p>
          {rows.map((row, i) => (
            <div key={i} data-chart-tooltip-row="" className="flex min-w-0 items-center gap-r5">
              {row.slot !== null && row.shape !== null && (
                // Series inks are validated against the surfaces, not the inverse bubble: the key
                // sits on a chip of the surface it was measured against.
                <span className="inline-flex shrink-0 rounded-sm bg-surface-0 px-r6">
                  <SeriesKey slot={row.slot} shape={row.shape} line={line} />
                </span>
              )}
              <span className="shrink-0 font-semibold tabular-nums">{row.value}</span>
              <span className="min-w-0 truncate">{row.name}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Cursor: pointer, keys, touch                                       */
/* ------------------------------------------------------------------ */

export type CursorSource = "pointer" | "keyboard" | "touch";

export interface ChartCursor<T> {
  active: T | null;
  source: CursorSource | null;
  set: (value: T | null, source: CursorSource | null) => void;
}

export function useCursor<T>(): ChartCursor<T> {
  const [state, setState] = useState<{ active: T | null; source: CursorSource | null }>({ active: null, source: null });
  const set = useCallback((active: T | null, source: CursorSource | null) => {
    setState((prev) => (prev.active === active && prev.source === source ? prev : { active, source }));
  }, []);
  return { active: state.active, source: state.source, set };
}

/**
 * Pointer, keyboard and touch for a one-dimensional readout (line, bar): hover
 * snaps to the nearest row, a tap inspects it, arrows step, Home/End jump,
 * Escape clears, and keyboard focus starts at the most recent row.
 */
export function useAxisCursor({
  order,
  rowPos,
  axis,
  nearest,
  root,
}: {
  order: readonly number[];
  rowPos: readonly (number | null)[];
  axis: "x" | "y";
  nearest: (rowPos: readonly (number | null)[], order: readonly number[], px: number) => number | null;
  root: RefObject<HTMLElement | null>;
}) {
  const cursor = useCursor<number>();
  const { active, source, set } = cursor;
  const step = (from: number | null, delta: number | "first" | "last") => {
    if (order.length === 0) return null;
    if (delta === "first") return order[0] ?? null;
    if (delta === "last") return order[order.length - 1] ?? null;
    const at = from === null ? -1 : order.indexOf(from);
    if (at === -1) return order[order.length - 1] ?? null;
    return order[Math.min(order.length - 1, Math.max(0, at + delta))] ?? null;
  };
  const fromEvent = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return nearest(rowPos, order, axis === "x" ? event.clientX - rect.left : event.clientY - rect.top);
  };

  useClickOutside(root, () => set(null, null), source === "touch");

  const handlers = {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "touch") return;
      set(fromEvent(event), "pointer");
    },
    onPointerLeave(event: PointerEvent<HTMLElement>) {
      if (event.pointerType !== "touch" && source === "pointer") set(null, null);
    },
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "touch") set(fromEvent(event), "touch");
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const map: Record<string, number | "first" | "last"> = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1,
        Home: "first",
        End: "last",
      };
      if (event.key === "Escape") {
        if (active === null) return;
        event.preventDefault();
        set(null, null);
        return;
      }
      const delta = map[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      set(step(active, delta), "keyboard");
    },
    onFocus(event: React.FocusEvent<HTMLElement>) {
      let visible = false;
      try {
        visible = event.currentTarget.matches(":focus-visible");
      } catch {
        visible = false;
      }
      if (visible && active === null) set(step(null, "last"), "keyboard");
    },
    onBlur() {
      if (source === "keyboard") set(null, null);
    },
  };
  return { ...cursor, handlers };
}

/** The plot's own wrapper: focusable, named, LTR (an axis reads left to right in every locale). */
export function PlotRegion({
  label,
  hint,
  className,
  style,
  children,
  ref,
  ...handlers
}: {
  label: string;
  hint: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
} & Partial<Record<"onPointerMove" | "onPointerLeave" | "onPointerDown", (event: PointerEvent<HTMLElement>) => void>> & {
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
    onBlur?: () => void;
  }) {
  const hintId = useId();
  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      dir="ltr"
      aria-label={label}
      aria-describedby={hintId}
      data-chart-plot=""
      className={cn("r-charts-plot relative min-w-0 rounded-sm text-body-3", className)}
      style={style}
      {...handlers}
    >
      <span id={hintId} className="sr-only">
        {hint}
      </span>
      {children}
    </div>
  );
}
