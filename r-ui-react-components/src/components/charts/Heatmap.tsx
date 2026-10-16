"use client";
import { type CSSProperties, type RefObject, useMemo, useRef, useState } from "react";

import { useLabels, useLocale } from "../../util/locale";
import { cn } from "../../util/style";
import { type ChartTable, makeFormatters, tidyLabel, type ValueFormatOptions } from "./chart-model";
import {
  type ChartBaseProps,
  ChartFrame,
  ChartReadout,
  DEFAULT_CHART_LABELS,
  PlotRegion,
  readoutStatus,
  usePlotCursor,
} from "./chart-parts";
import { heatLegend, type HeatmapModel, type HeatStep, modelHeatmap, planHeatAxis } from "./chart-plan";
import { useChartBox } from "./use-chart-box";

/* Literal strings so Tailwind's scanner sees every utility. The fills opt out
   of forced-colour repainting in `tokens.css`: the colour is the value. */
const SEQ_BG: Record<HeatStep, string> = {
  1: "bg-seq-1",
  2: "bg-seq-2",
  3: "bg-seq-3",
  4: "bg-seq-4",
  5: "bg-seq-5",
  6: "bg-seq-6",
  7: "bg-seq-7",
};

export interface HeatmapProps extends ChartBaseProps, Omit<ValueFormatOptions, "formatTick"> {
  /** Row labels, top to bottom ("Mon" … "Sun"). Missing ones are numbered. */
  rows: readonly string[];
  /** Column labels, start to end ("00" … "23"). Thinned to the width they have. */
  columns: readonly string[];
  /** `values[row][column]`. `null` is no data (drawn as an empty cell), never a zero. */
  values: readonly (readonly (number | null | undefined)[])[];
  /** What a value is ("5xx errors"), for the tooltip. */
  valueLabel?: string;
}

function heatTable(model: HeatmapModel, value: (v: number | null) => string, corner: string): ChartTable {
  return {
    corner,
    columns: model.columns,
    rows: model.rows.map((label, r) => ({ label, cells: (model.cells[r] ?? []).map((c) => value(c.value)) })),
  };
}

function parseCellKey(key: string | null): { r: number; c: number } | null {
  if (key === null) return null;
  const [r, c] = key.split(":").map(Number);
  return r === undefined || c === undefined ? null : { r, c };
}

/**
 * The heatmap's cursor is a cell's `"row:column"` key. Arrows move cell by
 * cell, Home/End to the row's ends (with Ctrl, the grid's), and keyboard focus
 * starts at the first cell.
 */
function useGridCursor(rows: number, columns: number, root: RefObject<HTMLElement | null>) {
  const empty = rows === 0 || columns === 0;
  const key = (r: number, c: number) => `${Math.min(rows - 1, Math.max(0, r))}:${Math.min(columns - 1, Math.max(0, c))}`;
  return usePlotCursor<string>({
    root,
    pick: (event) => (event.target as Element).closest?.("[data-cell]")?.getAttribute("data-cell") ?? null,
    keyTarget(active, event) {
      if (empty) return undefined;
      const at = parseCellKey(active);
      const r = at?.r ?? 0;
      const c = at?.c ?? 0;
      const next: Partial<Record<string, string>> = {
        ArrowRight: key(r, c + 1),
        ArrowLeft: key(r, c - 1),
        ArrowDown: key(r + 1, c),
        ArrowUp: key(r - 1, c),
        Home: event.ctrlKey ? key(0, 0) : key(r, 0),
        End: event.ctrlKey ? key(rows - 1, columns - 1) : key(r, columns - 1),
      };
      const to = next[event.key];
      if (to === undefined) return undefined;
      return at ? to : key(0, 0);
    },
    start: () => (empty ? null : key(0, 0)),
  });
}

/**
 * Magnitude over two categorical axes (weekday × hour): each cell one step of the
 * sequential ramp (seven equal bins, darkest = greatest on a light theme,
 * lightest on a dark one), a missing value an empty dashed cell. Cells are
 * `--HEAT-CELL` tall (density-aware) and share the width; column labels thin to fit.
 *
 * The legend shows the ramp with each bin's lower edge; the table carries every
 * value. The grid takes focus: arrows move cell by cell, Home/End to the row's
 * ends, and the value is announced politely; pointer hover and a tap show it.
 */
export function Heatmap({
  label,
  summary,
  rows,
  columns,
  values,
  valueLabel,
  unit,
  format,
  locale: localeProp,
  labels,
  className,
  classNames,
  ref,
  ...rest
}: HeatmapProps) {
  const words = useLabels("Chart", DEFAULT_CHART_LABELS, labels);
  const locale = useLocale(localeProp);
  const formatters = useMemo(() => makeFormatters({ unit, format, locale }), [unit, format, locale]);
  const model = useMemo(() => modelHeatmap({ rows, columns, values }), [rows, columns, values]);
  const plotRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const box = useChartBox(plotRef, probeRef);
  const axis = useMemo(() => planHeatAxis(model, box.width, box.fontSize, box.measure), [model, box]);
  const legend = useMemo(() => heatLegend(model, formatters), [model, formatters]);
  const name = tidyLabel(valueLabel ?? "") || words.value;

  const nRows = model.rows.length;
  const nCols = model.columns.length;
  const { active, source, handlers } = useGridCursor(nRows, nCols, plotRef);
  const at = parseCellKey(active);
  const cell = at ? model.cells[at.r]?.[at.c] : undefined;
  const title = cell ? `${model.rows[cell.row] ?? ""} · ${model.columns[cell.column] ?? ""}` : "";
  const valueText = cell ? formatters.value(cell.value) : "";
  const readout = [{ name, value: valueText, slot: null, shape: null }];
  const status = cell ? readoutStatus(title, readout, source) : "";
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const hasMissing = model.cells.some((r) => r.some((c) => c.value === null));
  const valued = model.drawable && nRows > 0 && nCols > 0;
  const summaryText =
    summary ??
    words.heatmapSummary({
      kind: words.kinds.heatmap,
      rows: nRows,
      firstRow: model.rows[0] ?? "",
      lastRow: model.rows[nRows - 1] ?? "",
      columns: nCols,
      firstColumn: model.columns[0] ?? "",
      lastColumn: model.columns[nCols - 1] ?? "",
      ...(valued && { low: formatters.value(model.lo), high: formatters.value(model.hi) }),
    });
  const notes: string[] = [];
  if (model.dropped.rows > 0 || model.dropped.columns > 0) {
    notes.push(words.gridCapped(nRows, nRows + model.dropped.rows, nCols, nCols + model.dropped.columns));
  }

  const gridStyle = { "--r-charts-heat-cols": nCols, "--r-charts-heat-label": axis.labelWidth } as CSSProperties;

  return (
    <ChartFrame
      kind="heatmap"
      label={label}
      summaryText={summaryText}
      legend={
        <div aria-hidden data-chart-legend="" className={cn("flex flex-wrap items-center gap-x-r4 gap-y-r5 text-body-3 text-fg-secondary", classNames?.legend)}>
          <span className="flex items-center gap-r6">
            <span className="tabular-nums">{legend[0]?.from}</span>
            <span className="flex gap-px">
              {legend.map((l) => (
                <span key={l.step} data-step={l.step} className={cn("size-heat-cell rounded-sm border border-transparent", SEQ_BG[l.step])} />
              ))}
            </span>
            <span className="tabular-nums">{formatters.value(model.hi)}</span>
          </span>
          {hasMissing && (
            <span className="flex items-center gap-r6">
              <span className="r-charts-heat-missing size-heat-cell rounded-sm" />
              {words.noData}
            </span>
          )}
        </div>
      }
      notes={notes}
      table={heatTable(model, formatters.value, words.corner)}
      undrawable={nRows > 0 && nCols > 0 && !model.drawable}
      empty={nRows === 0 || nCols === 0}
      status={status}
      labelsResolved={words}
      className={className}
      classNames={classNames}
      ref={ref}
      {...rest}
    >
      <PlotRegion
        ref={plotRef}
        probeRef={probeRef}
        label={label}
        hint={words.keyboardHint}
        className={cn("w-full", classNames?.plot)}
        {...handlers}
      >
        <div aria-hidden className="r-charts-heat grid gap-px" style={gridStyle}>
          {model.cells.map((row, r) => [
            <span key={`l${r}`} className="truncate pe-r6 leading-(--HEAT-CELL) text-fg-muted">
              {axis.rowLabels[r]}
            </span>,
            ...row.map((c) => (
              <span
                key={`${r}:${c.column}`}
                data-cell={`${r}:${c.column}`}
                data-step={c.step ?? undefined}
                data-active={active === `${r}:${c.column}` || undefined}
                ref={active === `${r}:${c.column}` ? setAnchorEl : undefined}
                className={cn(
                  "r-charts-heat-cell h-heat-cell min-w-0 rounded-sm",
                  // A missing cell's dashed edge is its rule's; a filled cell keeps a transparent
                  // border so forced colours still draw its edge.
                  c.step === null ? "r-charts-heat-missing" : cn("border border-transparent", SEQ_BG[c.step]),
                )}
              />
            )),
          ])}
        </div>
        <div aria-hidden data-axis="category" className="relative h-(--BodyText-3-line-height) text-fg-muted">
          {axis.columnLabels.map((l) => (
            <span key={l.column} className="r-charts-heat-col absolute top-0 whitespace-nowrap tabular-nums" style={{ left: l.center }}>
              {l.text}
            </span>
          ))}
        </div>
        <ChartReadout
          line={false}
          open={cell !== undefined}
          anchor={null}
          anchorElement={active === null ? null : anchorEl}
          placement="top"
          title={title}
          rows={readout}
          className={classNames?.tooltip}
        />
      </PlotRegion>
    </ChartFrame>
  );
}
