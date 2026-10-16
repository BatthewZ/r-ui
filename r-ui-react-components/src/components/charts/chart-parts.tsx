"use client";
import {
  type CSSProperties,
  type FocusEvent,
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
import { type LabelsProp } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { topLayerExit, useExitPresence } from "../overlays/internal";
import { Button } from "../primitives";
import {
  type CartesianModel,
  cartesianNotes,
  cartesianSummaryParts,
  type CartesianSummaryParts,
  cartesianTable,
  type ChartNotes,
  type ChartTable,
  type DrawnSeries,
  type Formatters,
  type ModelRow,
  type SeriesShape,
  type SeriesSlot,
} from "./chart-model";
import { markPath, nearestRow, STROKED_SHAPES } from "./chart-plan";

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
  /** The table's first column header. Empty: `timeCorner` on a time axis, else nothing. */
  corner: string;
  /** The table's first column header on a time axis, where `corner` is empty. */
  timeCorner: string;
  /** Each chart's kind: the first words of its default summary. */
  kinds: { line: string; area: string; bar: string; stackedBar: string; heatmap: string };
  /** A line, area or bar chart's summary when the caller wrote none. */
  cartesianSummary: (parts: CartesianSummaryParts) => string;
  /** A heatmap's summary when the caller wrote none. */
  heatmapSummary: (parts: HeatmapSummaryParts) => string;
  /** A heatmap value's name in the readout, where the chart sets no `valueLabel`. */
  value: string;
  /** The stacked bar readout's sum row. */
  total: string;
  rowsCapped: (shown: number, total: number) => string;
  seriesCapped: (drawn: number, total: number, tabulated: number) => string;
  valuesDropped: (count: number) => string;
  gridCapped: (rows: number, totalRows: number, columns: number, totalColumns: number) => string;
}

/** The facts a heatmap's default summary is written from. */
export interface HeatmapSummaryParts {
  /** From `ChartLabels.kinds.heatmap`. */
  kind: string;
  rows: number;
  firstRow: string;
  lastRow: string;
  columns: number;
  firstColumn: string;
  lastColumn: string;
  /** The formatted value range; `undefined` when nothing can be drawn. */
  low?: string;
  high?: string;
}

export const DEFAULT_CHART_LABELS: ChartLabels = {
  showTable: "Show as table",
  showChart: "Show chart",
  noData: "No data",
  cannotDraw: "Nothing to draw: every value is missing or unplaceable. The table lists what there is.",
  keyboardHint: "Use the arrow keys to read the values; Home and End jump to the ends.",
  corner: "",
  timeCorner: "Time",
  kinds: { line: "Line chart", area: "Area chart", bar: "Bar chart", stackedBar: "Stacked bar chart", heatmap: "Heatmap" },
  cartesianSummary: ({ kind, series, points, first, last, low, high }) => {
    if (points === 0 || series.length === 0) return `${kind}, no data.`;
    const span = first === undefined ? "" : last === undefined ? `, ${first}` : `, ${first} to ${last}`;
    const values = low === undefined ? " No values." : ` Values from ${low} to ${high}.`;
    const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
    return `${kind}, ${count(series.length, "series", "series")} (${series.join(", ")}), ${count(points, "point", "points")}${span}.${values}`;
  },
  heatmapSummary: ({ kind, rows, firstRow, lastRow, columns, firstColumn, lastColumn, low, high }) => {
    const values = low === undefined ? " No values." : ` Values from ${low} to ${high}.`;
    return `${kind}, ${rows} rows (${firstRow} to ${lastRow}) by ${columns} columns (${firstColumn} to ${lastColumn}).${values}`;
  },
  value: "Value",
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

declare module "../../util/locale" {
  interface LabelsRegistry {
    Chart: ChartLabels;
  }
}

function notesText(notes: ChartNotes, labels: ChartLabels): string[] {
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
  labels?: LabelsProp<ChartLabels>;
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

/**
 * The `ChartFrame` props a line or bar chart derives from its model: the
 * summary (unless the caller wrote one), the notes, the table (its corner
 * `timeCorner` on a time axis unless `corner` names one) and the empty states.
 */
export function cartesianFrameProps(
  model: CartesianModel,
  formatters: Formatters,
  labels: ChartLabels,
  summary: string | undefined,
  kind: keyof ChartLabels["kinds"],
) {
  return {
    summaryText: summary ?? labels.cartesianSummary({ kind: labels.kinds[kind], ...cartesianSummaryParts(model, formatters) }),
    notes: notesText(cartesianNotes(model), labels),
    table: cartesianTable(model, formatters, labels.corner || (model.xType === "time" ? labels.timeCorner : "")),
    undrawable: model.rows.length > 0 && !model.drawable,
    empty: model.rows.length === 0 || model.series.length === 0,
    labelsResolved: labels,
  };
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

/** Every drawn series' value in `row`, for the readout. */
export function seriesReadout(row: ModelRow | undefined, drawn: readonly DrawnSeries[], formatters: Formatters): ReadoutRow[] {
  return row ? drawn.map((s) => ({ name: s.name, value: formatters.value(row.values[s.index] ?? null), slot: s.slot, shape: s.shape })) : [];
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

function useCursor<T>() {
  const [state, setState] = useState<{ active: T | null; source: CursorSource | null }>({ active: null, source: null });
  const set = useCallback((active: T | null, source: CursorSource | null) => {
    setState((prev) => (prev.active === active && prev.source === source ? prev : { active, source }));
  }, []);
  return { active: state.active, source: state.source, set };
}

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

/** The plot's event handlers, as `usePlotCursor` returns them and `PlotRegion` takes them. */
export interface PlotHandlers {
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
}

/**
 * The readout cursor every chart shares: hover follows `pick`, a tap inspects
 * (a press outside clears it), `keyTarget` moves it, Escape clears it, and
 * keyboard focus starts it at `start`.
 */
export function usePlotCursor<T>({
  root,
  pick,
  keyTarget,
  start,
}: {
  root: RefObject<HTMLElement | null>;
  /** The row or cell under a pointer event. */
  pick: (event: PointerEvent<HTMLElement>) => T | null;
  /** Where a key moves the cursor from `active`; `undefined` for a key the plot does not use. */
  keyTarget: (active: T | null, event: KeyboardEvent<HTMLElement>) => T | null | undefined;
  /** Where the cursor starts when the plot takes keyboard focus. */
  start: () => T | null;
}) {
  const cursor = useCursor<T>();
  const { active, source, set } = cursor;

  useClickOutside(root, () => set(null, null), source === "touch");

  const handlers: Required<PlotHandlers> = {
    onPointerMove(event) {
      if (event.pointerType === "touch") return;
      set(pick(event), "pointer");
    },
    onPointerLeave(event) {
      if (event.pointerType !== "touch" && source === "pointer") set(null, null);
    },
    onPointerDown(event) {
      if (event.pointerType === "touch") set(pick(event), "touch");
    },
    onKeyDown(event) {
      if (event.key === "Escape") {
        if (active === null) return;
        event.preventDefault();
        set(null, null);
        return;
      }
      const to = keyTarget(active, event);
      if (to === undefined) return;
      event.preventDefault();
      set(to, "keyboard");
    },
    onFocus(event) {
      if (isFocusVisible(event.currentTarget) && active === null) set(start(), "keyboard");
    },
    onBlur() {
      if (source === "keyboard") set(null, null);
    },
  };
  return { ...cursor, handlers };
}

const AXIS_KEYS: Partial<Record<string, number | "first" | "last">> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: "first",
  End: "last",
};

/**
 * Pointer, keyboard and touch for a one-dimensional readout (line, bar): hover
 * snaps to the nearest row, a tap inspects it, arrows step, Home/End jump,
 * Escape clears, and keyboard focus starts at the most recent row.
 */
export function useAxisCursor({
  order,
  rowPos,
  axis,
  root,
}: {
  order: readonly number[];
  rowPos: readonly (number | null)[];
  axis: "x" | "y";
  root: RefObject<HTMLElement | null>;
}) {
  const step = (from: number | null, delta: number | "first" | "last") => {
    if (order.length === 0) return null;
    if (delta === "first") return order[0] ?? null;
    if (delta === "last") return order[order.length - 1] ?? null;
    const at = from === null ? -1 : order.indexOf(from);
    if (at === -1) return order[order.length - 1] ?? null;
    return order[Math.min(order.length - 1, Math.max(0, at + delta))] ?? null;
  };
  return usePlotCursor<number>({
    root,
    pick(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      return nearestRow(rowPos, order, axis === "x" ? event.clientX - rect.left : event.clientY - rect.top);
    },
    keyTarget(active, event) {
      const delta = AXIS_KEYS[event.key];
      return delta === undefined ? undefined : step(active, delta);
    },
    start: () => step(null, "last"),
  });
}

/** What the live region says for a keyboard step or a tap (never a passing pointer): the readout as one line. */
export function readoutStatus(title: string, rows: readonly ReadoutRow[], source: CursorSource | null): string {
  return source === "keyboard" || source === "touch" ? `${title}: ${rows.map((r) => `${r.name} ${r.value}`).join(", ")}` : "";
}

/** The plot's own wrapper: focusable, named, LTR (an axis reads left to right in every locale). */
export function PlotRegion({
  label,
  hint,
  probeRef,
  className,
  style,
  children,
  ref,
  ...handlers
}: {
  label: string;
  hint: string;
  /** The hidden `h-bar rounded-sm` probe `useChartBox` reads `--BAR-THICK` and `--RADIUS-SM` from. */
  probeRef: Ref<HTMLSpanElement>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
} & PlotHandlers) {
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
      <span ref={probeRef} aria-hidden className="r-charts-probe h-bar rounded-sm" />
      {children}
    </div>
  );
}
