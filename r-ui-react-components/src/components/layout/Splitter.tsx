"use client";
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { elementChildren } from "../../util/children";
import { isRtl } from "../../util/direction";
import { type LabelsProp, useLabels } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { resolveLength } from "../../util/resolve-length";
import { cn, type SlotClassNames } from "../../util/style";
import {
  dragTarget,
  fitSizes,
  isCollapsed,
  keyTarget,
  normalizeSizes,
  openMin,
  pairRange,
  type PaneBounds,
  placePrimary,
  roundSize,
  type SplitterKey,
} from "./splitter-model";

export interface SplitterLabels {
  /** A separator's name, from the name of the pane it resizes. */
  resize: (pane: string) => string;
  /** A pane's name when it has no `label`, from its position (1-based). */
  pane: (position: number) => string;
}

export const DEFAULT_SPLITTER_LABELS: SplitterLabels = {
  resize: (pane) => `Resize ${pane}`,
  pane: (position) => `Pane ${position}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Splitter: SplitterLabels;
  }
}

/**
 * A pane bound: a number is a share of the space the panes divide (0–100); a
 * string is a CSS length, written with tokens (`"var(--COLUMN-SM)"`,
 * `"calc(var(--CONTROL-H) * 6)"`), resolved inside the splitter so density moves it.
 */
export type SplitterLength = number | string;

export type SplitterOrientation = "horizontal" | "vertical";

export interface SplitterProps extends Omit<ComponentPropsWithRef<"div">, "defaultValue"> {
  /** `horizontal`: panes side by side, separators upright (default). `vertical`: panes stacked. */
  orientation?: SplitterOrientation;
  /** Each pane's share (0–100) of the space, in pane order. Scaled to 100; ignored if the count differs. */
  sizes?: readonly number[];
  /** Uncontrolled starting sizes. Omitted: an equal split. */
  defaultSizes?: readonly number[];
  /** Every change, including each step of a drag. */
  onSizesChange?: (sizes: number[]) => void;
  /** Once per gesture (a drag's release, a key's release), with the sizes it left: persist these. */
  onSizesCommit?: (sizes: number[]) => void;
  /** How far an arrow key moves a separator, as a share (0–100). @default 5 */
  keyboardStep?: number;
  labels?: LabelsProp<SplitterLabels>;
  classNames?: SlotClassNames<"separator">;
}

export interface SplitterPaneProps extends ComponentPropsWithRef<"div"> {
  /** Names the separator that resizes this pane ("Resize {label}"). */
  label?: string;
  /** Smallest open size: a share (0–100) or a token length. @default 0 */
  min?: SplitterLength;
  /** Largest size: a share (0–100) or a token length. @default 100 */
  max?: SplitterLength;
  /** It may collapse to nothing: Enter on its separator, Home, a drag past half its `min`. */
  collapsible?: boolean;
}

interface SplitterContextValue {
  sizes: readonly number[];
  collapsed: readonly boolean[];
  paneIds: readonly string[];
}

const SplitterContext = createContext<SplitterContextValue | null>(null);
const PaneIndexContext = createContext<number>(-1);

/** Lengths resolved by layout: the space the panes divide, and each CSS length in px. */
interface Metrics {
  available: number;
  lengths: Readonly<Record<string, number>>;
}

const sameSizes = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Number.NaN)) < 1e-9);

function toShare(length: SplitterLength | undefined, fallback: number, metrics: Metrics): number {
  if (length === undefined) return fallback;
  if (typeof length === "number") return length;
  const px = metrics.lengths[length];
  return px === undefined || metrics.available <= 0 ? fallback : (px / metrics.available) * 100;
}

function measure(root: HTMLElement, horizontal: boolean, lengths: readonly string[]): Metrics {
  const panes = [...root.children].filter((el) => el.hasAttribute("data-splitter-pane"));
  const available = panes.reduce((total, el) => {
    const rect = el.getBoundingClientRect();
    return total + (horizontal ? rect.width : rect.height);
  }, 0);
  const resolved: Record<string, number> = {};
  // Inside the root, so each length follows the density written there.
  for (const length of lengths) resolved[length] = resolveLength(root, length);
  return { available, lengths: resolved };
}

const sameMetrics = (a: Metrics, b: Metrics) =>
  Math.abs(a.available - b.available) < 0.5 &&
  Object.keys(b.lengths).every((k) => Math.abs((a.lengths[k] ?? Number.NaN) - (b.lengths[k] ?? 0)) < 0.5);

/**
 * Resizable panes, side by side or stacked, with a focusable separator between
 * each pair (the APG window splitter).
 *
 * - A separator is `role="separator"` valued at its primary pane's share (the
 *   pane before it, or the one after it when only that one collapses), named
 *   "Resize {pane label}" and `aria-controls` that pane.
 * - Keys: the arrows on the splitter's axis move it by `keyboardStep` (mirrored
 *   in RTL), Home and End to the primary pane's smallest and largest, Enter
 *   collapses a collapsible pane and restores it to where it was. A double
 *   click does what Enter does, for a pointer that cannot drag.
 * - Pointer: a drag follows the pointer (captured, so it keeps following off
 *   the separator); a collapsible pane collapses once dragged below half its
 *   minimum.
 * - A separator moves space between its two panes only. Sizes outside a pane's
 *   bounds (after the splitter narrowed) are drawn inside them; the next
 *   gesture starts from what is drawn.
 * - The separator is a thin gutter (`--R-SIZE-5`, so it follows density) drawing
 *   a hairline that firms to the accent on hover, focus and drag, as a table's
 *   column handle does; its hit area is at least `--HIT-MIN` across, hung over
 *   the pane after it so it never covers the scrollbar of the pane before.
 *
 * Give it a size on its axis (a height for `vertical`, and usually for
 * `horizontal` too); each pane scrolls its own content. Panes are
 * `Splitter.Pane` children; a splitter nests inside a pane.
 */
function SplitterRoot({
  orientation = "horizontal",
  sizes: sizesProp,
  defaultSizes,
  onSizesChange,
  onSizesCommit,
  keyboardStep = 5,
  labels: labelsProp,
  className,
  classNames,
  children,
  ref,
  ...props
}: SplitterProps) {
  const labels = useLabels("Splitter", DEFAULT_SPLITTER_LABELS, labelsProp);
  const horizontal = orientation === "horizontal";
  const panes = elementChildren<SplitterPaneProps>(children, SplitterPane);
  const count = panes.length;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [stored, setStored] = useControllableState<readonly number[]>({
    value: sizesProp,
    defaultValue: defaultSizes ?? [],
    onChange: onSizesChange && ((next) => onSizesChange([...next])),
    isEqual: sameSizes,
  });

  const specs = panes.map((pane) => ({ min: pane.props.min, max: pane.props.max, collapsible: Boolean(pane.props.collapsible) }));
  const lengths = [...new Set(specs.flatMap((s) => [s.min, s.max]).filter((v): v is string => typeof v === "string"))];
  const lengthsKey = lengths.join("\n");

  const [metrics, setMetrics] = useState<Metrics>({ available: 0, lengths: {} });
  const remeasure = useCallback((): Metrics | null => {
    const root = rootRef.current;
    if (!root) return null;
    const next = measure(root, horizontal, lengthsKey ? lengthsKey.split("\n") : []);
    setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));
    return next;
  }, [horizontal, lengthsKey]);

  // Re-measured when the splitter resizes, and when a separator does: its
  // thickness is a density token, so a density switch reaches the token lengths too.
  useLayoutEffect(() => {
    const root = rootRef.current;
    remeasure();
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => remeasure());
    observer.observe(root);
    for (const el of root.querySelectorAll(":scope > [data-splitter-separator]")) observer.observe(el);
    return () => observer.disconnect();
  }, [remeasure, count]);

  const boundsFor = (m: Metrics): PaneBounds[] =>
    specs.map((s) => ({ min: toShare(s.min, 0, m), max: toShare(s.max, 100, m), collapsible: s.collapsible }));
  const bounds = boundsFor(metrics);
  const sizes = fitSizes(normalizeSizes(stored, count), bounds);
  const collapsed = sizes.map((_, i) => isCollapsed(sizes, bounds, i));
  const paneIds = panes.map((pane, i) => pane.props.id ?? `${baseId}-pane-${i}`);

  // A gesture's starting sizes, compared at its end so it commits once and only if it moved something.
  const gesture = useRef<readonly number[] | null>(null);
  // Where each collapsed pane was, for Enter to restore.
  const restore = useRef(new Map<number, number>());
  const drag = useRef<{ pointerId: number; start: number; from: number; available: number; rtl: boolean; separator: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  /** Fresh bounds and the drawn sizes at the start of a gesture: density or the splitter's size may have moved since. */
  const startGesture = () => {
    const m = remeasure() ?? metrics;
    const b = boundsFor(m);
    const drawn = fitSizes(normalizeSizes(stored, count), b);
    gesture.current ??= drawn;
    return { b, drawn, available: m.available };
  };
  /** Commits what the gesture changed, read from the sizes drawn now (a later event than the change). */
  const endGesture = () => {
    const from = gesture.current;
    gesture.current = null;
    if (from && !sameSizes(from, sizes)) onSizesCommit?.([...sizes]);
  };
  /** Moves separator `separator`'s primary pane to `target`, remembering where a collapsing pane was. */
  const place = (drawn: readonly number[], b: readonly PaneBounds[], separator: number, target: number): number[] => {
    const range = pairRange(drawn, b, separator);
    const current = drawn[range.primary] ?? 0;
    if (range.collapsible && target <= 0 && current > 0) restore.current.set(range.primary, current);
    else if (target > 0) restore.current.delete(range.primary);
    const next = placePrimary(drawn, range, target);
    if (!sameSizes(next, drawn)) setStored(next);
    return next;
  };

  /** Enter and double click: collapse a collapsible primary pane, or restore it to where it was. */
  const toggleCollapse = (separator: number): number[] | null => {
    const { b, drawn } = startGesture();
    const range = pairRange(drawn, b, separator);
    if (!range.collapsible) return null;
    const current = drawn[range.primary] ?? 0;
    const open = openMin(range, keyboardStep);
    const back = restore.current.get(range.primary) ?? open;
    return place(drawn, b, separator, current > 0 ? 0 : Math.min(Math.max(back, open), range.hi));
  };

  const onKeyDown = (separator: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      toggleCollapse(separator);
      return;
    }
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    const backward = horizontal ? "ArrowLeft" : "ArrowUp";
    let move: "toEnd" | "toStart" | SplitterKey;
    if (event.key === forward || event.key === backward) {
      // Toward the end of the axis: right in LTR, left in RTL, down when stacked.
      const toEnd = (event.key === forward) !== (horizontal && isRtl(event.currentTarget));
      move = toEnd ? "toEnd" : "toStart";
    } else if (event.key === "Home") move = "min";
    else if (event.key === "End") move = "max";
    else return;
    event.preventDefault();
    const { b, drawn } = startGesture();
    const range = pairRange(drawn, b, separator);
    // Moving toward the end grows the pane before the separator.
    const primaryBefore = range.primary === separator;
    let key: SplitterKey;
    if (move === "toEnd") key = primaryBefore ? "grow" : "shrink";
    else if (move === "toStart") key = primaryBefore ? "shrink" : "grow";
    else key = move;
    place(drawn, b, separator, keyTarget(drawn[range.primary] ?? 0, range, key, keyboardStep));
  };

  const onPointerDown = (separator: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault();
    const { drawn, available } = startGesture();
    const el = event.currentTarget;
    drag.current = {
      pointerId: event.pointerId,
      start: horizontal ? event.clientX : event.clientY,
      from: drawn[separator] ?? 0,
      available,
      rtl: horizontal && isRtl(el),
      separator,
    };
    el.setPointerCapture?.(event.pointerId);
    el.focus({ preventScroll: true });
    setDragging(separator);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId || d.available <= 0) return;
    const px = ((horizontal ? event.clientX : event.clientY) - d.start) * (d.rtl ? -1 : 1);
    const range = pairRange(sizes, bounds, d.separator);
    // The pane before the separator follows the pointer; the primary may be the one after it.
    const before = d.from + (px / d.available) * 100;
    const proposed = range.primary === d.separator ? before : range.total - before;
    place(sizes, bounds, d.separator, dragTarget(proposed, range));
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
    endGesture();
  };

  const context: SplitterContextValue = { sizes, collapsed, paneIds };
  const name = (i: number) => panes[i]?.props.label ?? labels.pane(i + 1);

  return (
    <SplitterContext value={context}>
      <div
        data-print="flow"
        {...props}
        ref={mergeRefs(ref, rootRef)}
        data-orientation={orientation}
        className={cn("r-layout-splitter flex min-h-0 min-w-0", horizontal ? "flex-row" : "flex-col", className)}
      >
        {panes.map((pane, i) => {
          const separator = i - 1;
          const range = separator >= 0 ? pairRange(sizes, bounds, separator) : null;
          return [
            range && (
              <div
                key={`separator-${pane.key ?? i}`}
                role="separator"
                tabIndex={0}
                aria-orientation={horizontal ? "vertical" : "horizontal"}
                aria-label={labels.resize(name(range.primary))}
                aria-controls={paneIds[range.primary]}
                aria-valuenow={Math.round(sizes[range.primary] ?? 0)}
                aria-valuemin={Math.round(range.collapsible ? 0 : range.lo)}
                aria-valuemax={Math.round(range.hi)}
                data-splitter-separator=""
                data-resizing={dragging === separator || undefined}
                // The pane after it is collapsed: the hit area hangs back over the pane before.
                data-hang={(sizes[i] ?? 0) === 0 ? "start" : undefined}
                data-print="hide"
                className={cn("r-layout-splitter-separator z-raised focus-visible:focus-ring-inset", classNames?.separator)}
                onKeyDown={onKeyDown(separator)}
                onKeyUp={endGesture}
                onBlur={endGesture}
                onDoubleClick={() => {
                  // One event: commit what it left now, not on a later one.
                  const next = toggleCollapse(separator);
                  const from = gesture.current;
                  gesture.current = null;
                  if (next && from && !sameSizes(from, next)) onSizesCommit?.(next);
                }}
                onPointerDown={onPointerDown(separator)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onLostPointerCapture={onPointerEnd}
              >
                <span aria-hidden className="r-layout-splitter-hit hit-area" />
              </div>
            ),
            <PaneIndexContext key={pane.key ?? i} value={i}>
              {pane}
            </PaneIndexContext>,
          ];
        })}
      </div>
    </SplitterContext>
  );
}

/**
 * One pane: it takes its share of the space and scrolls its own content. A
 * collapsed pane is `inert` and skips rendering its content (which keeps its
 * state and scroll position).
 */
function SplitterPane({ label: _label, min: _min, max: _max, collapsible: _collapsible, className, style, ...props }: SplitterPaneProps) {
  const ctx = useContext(SplitterContext);
  const index = useContext(PaneIndexContext);
  if (!ctx || index < 0) throw new Error("Splitter.Pane must be a direct child of <Splitter>");
  const collapsed = ctx.collapsed[index] ?? false;
  return (
    <div
      data-print="flow"
      {...props}
      id={ctx.paneIds[index]}
      data-splitter-pane=""
      data-collapsed={collapsed || undefined}
      inert={collapsed || undefined}
      style={{ ...style, flexGrow: roundSize(ctx.sizes[index] ?? 0) }}
      className={cn("r-layout-splitter-pane", className)}
    />
  );
}

/** Compound: `Splitter.Pane` children, a separator rendered between each pair. */
export const Splitter = Object.assign(SplitterRoot, { Pane: SplitterPane });
