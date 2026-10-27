"use client";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FloatingFocusManager, useDismiss, useFloating, useInteractions } from "../../hooks/use-floating";
import { usePressDrag } from "../../hooks/use-press-drag";
import { isRtl } from "../../util/direction";
import { formatNumber } from "../../util/format";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { MARK_TEXT, ToneGlyph } from "../../util/tone";
import { onEscape, topLayerExit, useExitPresence } from "../overlays/internal";
import { Button } from "../primitives";
import { addDays, addMonths, isSameDay, parseISODate, startOfMonth, toISODate, weekdayNames } from "./date-core";
import { daysBetween, type LaneSegment, layoutRow, monthWeeks, type PlacedEvent } from "./event-core";
import {
  type CalendarRange,
  dayRange,
  describeRange,
  isEditableEvent,
  moveToDay,
  rangeOf,
  rangeTouchesDay,
  resizeToDay,
  sameRange,
} from "./event-edit";
import {
  dayName,
  type EventCalendarLabels,
  EventMark,
  EventTarget,
  type EventViewProps,
  eventName,
  formatEventTime,
  formatTimeOfDay,
  isInteractiveEvent,
} from "./event-parts";

export interface EventMonthViewProps extends EventViewProps {
  /** The events a day shows before "+n more" (that row included), at least 1. */
  maxEventsPerDay: number;
}

const KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);
/** With Shift, these extend the range being picked; paging (with or without Shift) keeps it as it is. */
const PICK_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/** A narrow cell draws this many dots, then "+n". */
const MAX_DOTS = 3;

/** A part placed over the row's cells: its first column, its span and its lane. */
const laneStyle = (column: number, span: number, lane: number) =>
  ({ "--r-dates-col": column, "--r-dates-span": span, "--r-dates-lane": lane }) as CSSProperties;

/** What a pointer press in the month is about: picking days from one, or moving or resizing an event. */
type MonthPress = { kind: "pick"; day: Date } | { kind: "move" | "resize"; placed: PlacedEvent };

/** A range on screen before it is committed: being picked, or where a moved or resized event would land. */
type Draft = { kind: "pick"; range: CalendarRange } | { kind: "move" | "resize"; key: string; range: CalendarRange };

/** Where `range` crosses `week`: its first column, its span and whether it goes on past either end; `null` when it misses. */
function bandIn(range: CalendarRange, week: readonly Date[]) {
  const cols = week.flatMap((day, col) => (rangeTouchesDay(range, day) ? [col] : []));
  const first = cols[0];
  const last = cols.at(-1);
  if (first === undefined || last === undefined) return null;
  return {
    col: first,
    span: last - first + 1,
    before: first === 0 && rangeTouchesDay(range, addDays(week[0] as Date, -1)),
    after: last === week.length - 1 && rangeTouchesDay(range, addDays(week[last] as Date, 1)),
  };
}

/** The day whose cell holds the point, else the nearest cell's (past the grid's edges). */
function dayAtPoint(grid: HTMLElement | null, x: number, y: number): Date | null {
  let best: { day: Date; distance: number } | null = null;
  for (const cell of grid?.querySelectorAll<HTMLElement>('[role="gridcell"][data-day]') ?? []) {
    const day = parseISODate(cell.dataset.day ?? "");
    if (!day) continue;
    const r = cell.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const distance = dx * dx + dy * dy;
    if (!best || distance < best.distance) best = { day, distance };
  }
  return best?.day ?? null;
}

/**
 * The month view: the WAI-ARIA date grid, one row per week, a cell per day.
 *
 * One tab stop, the active day (`date`); arrows move by day and week (left and
 * right follow the reading direction), Home/End to the week's ends,
 * PageUp/PageDown by month, with Shift by year, paging the month when the day
 * leaves it. Enter, Space or a press on a cell opens that day's panel: a
 * non-modal dialog listing every event of the day, which is how the keyboard
 * reaches each event.
 *
 * By the calendar's own width: at `--MEASURE` and wider, events are chips in
 * lanes (multi-day ones a bar across their days, a crowded day's last lane
 * "+n more"), pointer and screen-reader browse targets out of the tab order;
 * narrower, a cell shows dots and the whole cell is the target.
 *
 * Picking (with `onSelectionChange`): a drag from a day (not from an event;
 * a touch holds first) picks the days from there to the day under the
 * pointer, in reading order across weeks; Shift with an arrow, Home or End
 * extends a range from where it began to the active day (paging the month
 * keeps it) and Enter picks it once it holds two days or more; the day panel's
 * "New event" picks its day. Escape drops a range being picked and clears the
 * picked one (the open panel closes first). The picked range stays drawn, and
 * its days say so in their names and `aria-selected`, until the app clears it.
 *
 * Moving (with `onEventChange`, never an `editable: false` event): a chip or
 * bar drags to another day, keeping a timed event's time and the day it was
 * pressed on under the pointer; an all-day bar's inline-end grip drags its last
 * day. The month has no keyboard move: the week and day views are the
 * keyboard's way to move and resize, and the narrow look has no chips to drag.
 */
export function EventMonthView({
  placed,
  date,
  onDateChange,
  title,
  weekStart,
  locale,
  now,
  labels,
  onEventClick,
  onOpenDay,
  classNames,
  maxEventsPerDay,
  selection,
  onSelectionChange,
  onEventChange,
  announce,
}: EventMonthViewProps) {
  const monthStart = startOfMonth(date).getTime();
  const weeks = useMemo(() => monthWeeks(new Date(monthStart), weekStart), [monthStart, weekStart]);
  const rows = useMemo(
    () => weeks.map((week) => layoutRow(placed, week[0] as Date, 7, maxEventsPerDay)),
    [weeks, placed, maxEventsPerDay],
  );
  const names = weekdayNames(locale, weekStart);
  const today = new Date(now);
  const month = date.getMonth();

  /** Every event on `day` in day order, or `null` when the month does not show it. */
  const eventsOn = (day: Date): PlacedEvent[] | null => {
    for (const [r, week] of weeks.entries()) {
      const col = week.findIndex((d) => isSameDay(d, day));
      if (col >= 0) return rows[r]?.events[col] ?? [];
    }
    return null;
  };

  // ── The day panel: one per view, anchored to its day's cell ──
  const [panel, setPanel] = useState<{ day: Date; open: boolean } | null>(null);
  const open = panel?.open ?? false;
  const panelEvents = panel ? eventsOn(panel.day) : null;
  // The day left the month (the date was moved from outside): the panel goes with it.
  if (open && panel && !panelEvents) setPanel({ ...panel, open: false });

  const panelRef = useRef<HTMLDivElement>(null);
  const present = useExitPresence(open, panelRef, topLayerExit);
  const close = () => setPanel((p) => (p?.open ? { ...p, open: false } : p));
  const floating = useFloating({
    placement: "bottom",
    open: present,
    onOpenChange: (next) => {
      if (!next) close();
    },
  });
  // Light dismiss from the pointer; Escape is the panel's own (`onEscape`).
  const { getFloatingProps } = useInteractions([useDismiss(floating.context, { escapeKey: false })]);
  const panelId = useId();
  const headingId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const cellFor = (day: Date) => rootRef.current?.querySelector<HTMLElement>(`[role="gridcell"][data-day="${toISODate(day)}"]`);

  // The grid is the panel's reference: a press anywhere in it is not an outside
  // press (a cell re-targets the panel instead), and focus returns to its tab
  // stop, the active day, which is the panel's day. The panel is POSITIONED at
  // the day's cell as rendered now: opening a neighbouring month's day pages
  // the month, which draws that day in another cell.
  const panelIso = panel ? toISODate(panel.day) : null;
  const { setPositionReference } = floating.refs;
  useLayoutEffect(() => {
    if (!panelIso) return;
    const cell = rootRef.current?.querySelector<HTMLElement>(`[role="gridcell"][data-day="${panelIso}"]`);
    if (cell) setPositionReference(cell);
  }, [panelIso, weeks, setPositionReference]);

  // Re-targeted while open (a press on another day): focus follows into the
  // panel, as it did when it opened.
  const shownIso = useRef<string | null>(null);
  useEffect(() => {
    const was = shownIso.current;
    shownIso.current = open ? panelIso : null;
    const el = panelRef.current;
    if (!open || !el || was === null || was === panelIso) return;
    (el.querySelector<HTMLElement>("a[href], button:not([disabled])") ?? el).focus();
  }, [open, panelIso]);

  // A keyboard move focuses the new active day after the render that shows it
  // (the shell pages the month first when the day left it).
  const pendingFocus = useRef(false);
  const activeIso = toISODate(date);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    rootRef.current?.querySelector<HTMLElement>(`[role="gridcell"][data-day="${activeIso}"]`)?.focus();
  });

  const openDay = (day: Date) => {
    if (!isSameDay(day, date)) onDateChange(day);
    setPanel({ day, open: true });
  };

  // ── Picking, moving and resizing ──
  const [draft, setDraft] = useState<Draft | null>(null);
  // Where the keyboard's range began (Shift with arrows); `null` when the keyboard is not picking.
  const anchor = useRef<Date | null>(null);
  const dropPick = () => {
    anchor.current = null;
    setDraft((d) => (d?.kind === "pick" ? null : d));
  };
  const commitPick = (range: CalendarRange) => {
    anchor.current = null;
    setDraft(null);
    onSelectionChange?.(range);
    announce(labels.selected(describeRange(range, locale, labels)));
  };

  // The day a moved event was pressed on, counted from its first day.
  const moveOffset = useRef(0);
  const rangeAt = (press: MonthPress, x: number, y: number): CalendarRange | null => {
    const day = dayAtPoint(rootRef.current, x, y);
    if (!day) return null;
    if (press.kind === "pick") return dayRange(press.day, day);
    if (press.kind === "resize") return resizeToDay(press.placed, day);
    return moveToDay(press.placed, addDays(day, -moveOffset.current));
  };
  const drag = usePressDrag<MonthPress>({
    onStart: ({ payload, x0, y0 }) => {
      anchor.current = null;
      close();
      if (payload.kind === "pick") {
        setDraft({ kind: "pick", range: dayRange(payload.day, payload.day) });
        return;
      }
      const pressed = dayAtPoint(rootRef.current, x0, y0);
      moveOffset.current = pressed ? daysBetween(payload.placed.firstDay, pressed) : 0;
      setDraft({ kind: payload.kind, key: payload.placed.key, range: rangeOf(payload.placed) });
    },
    onMove: ({ payload, x, y }) => {
      const range = rangeAt(payload, x, y);
      if (range) setDraft((d) => d && (sameRange(d.range, range) ? d : { ...d, range }));
    },
    onEnd: ({ payload, x, y }, how) => {
      setDraft(null);
      const range = how === "drop" ? rangeAt(payload, x, y) : null;
      if (!range) return;
      if (payload.kind === "pick") return commitPick(range);
      const p = payload.placed;
      if (sameRange(range, rangeOf(p))) return;
      onEventChange?.({ event: p.event, kind: payload.kind, ...range });
      announce(labels.dropped(p.event.title, describeRange(range, locale, labels)));
    },
  });
  const viewRef = useMemo(() => mergeRefs(rootRef, drag.rootRef), [drag.rootRef]);

  const onCellPointerDown = (day: Date) => (event: PointerEvent<HTMLDivElement>) => {
    // An interactive event takes its own press (a movable one starts its own drag).
    if ((event.target as Element).closest("a[data-event], button[data-event]")) return;
    drag.onPointerDown(event, { kind: "pick", day });
  };
  const editable = (p: PlacedEvent) => isEditableEvent(p, onEventChange);
  const onEventPointerDown = (p: PlacedEvent, kind: "move" | "resize") => (event: PointerEvent<HTMLElement>) =>
    drag.onPointerDown(event, { kind, placed: p });

  const onGridBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Leaving the grid drops a range the keyboard was picking.
    if (anchor.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) dropPick();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = event.target as HTMLElement;
    const from = cell.getAttribute("role") === "gridcell" ? parseISODate(cell.dataset.day ?? "") : null;
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
        return;
      }
      const clearing = selection !== null && onSelectionChange !== undefined;
      if (draft?.kind !== "pick" && !clearing) return;
      event.preventDefault();
      dropPick();
      if (clearing) {
        onSelectionChange(null);
        announce(labels.selectionCleared);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const picked = draft?.kind === "pick" ? draft.range : null;
      if (event.key === "Enter" && picked && !isSameDay(picked.start, picked.end)) return commitPick(picked);
      dropPick();
      openDay(from);
      return;
    }
    if (!KEYS.has(event.key)) return;
    event.preventDefault();
    const rtl = isRtl(event.currentTarget);
    const offset = (from.getDay() - weekStart + 7) % 7;
    const step: Partial<Record<string, number>> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7 };
    const days = step[event.key];
    const next =
      days !== undefined
        ? addDays(from, days)
        : event.key === "Home"
          ? addDays(from, -offset)
          : event.key === "End"
            ? addDays(from, 6 - offset)
            : addMonths(from, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1));
    if (PICK_KEYS.has(event.key)) {
      if (event.shiftKey && onSelectionChange) {
        const start = anchor.current ?? from;
        anchor.current = start;
        setDraft({ kind: "pick", range: dayRange(start, next) });
      } else {
        dropPick();
      }
    }
    if (isSameDay(next, date)) {
      cellFor(next)?.focus();
      return;
    }
    pendingFocus.current = true;
    onDateChange(next);
  };

  const onCellClick = (day: Date) => (event: MouseEvent<HTMLDivElement>) => {
    // An interactive event takes its own press.
    if ((event.target as Element).closest("a[data-event], button[data-event]")) return;
    openDay(day);
  };

  // What the days say they are in: the range being picked, else the picked one.
  const picked = onSelectionChange ? (draft?.kind === "pick" ? draft.range : selection) : null;
  // Drawn: the picked range (unless a new one is being picked) and the draft.
  const bands: { kind: Draft["kind"] | "selection"; range: CalendarRange }[] = [];
  if (onSelectionChange && selection && draft?.kind !== "pick") bands.push({ kind: "selection", range: selection });
  if (draft) bands.push(draft);
  const movingKey = draft && draft.kind !== "pick" ? draft.key : null;

  return (
    <div
      ref={viewRef}
      className="r-dates-month-view"
      style={{ "--r-dates-lanes": maxEventsPerDay } as CSSProperties}
    >
      <div
        ref={floating.refs.setReference}
        role="grid"
        aria-label={title}
        data-editable={onSelectionChange || onEventChange ? "" : undefined}
        className="r-dates-month-grid text-body-3"
        onKeyDown={onKeyDown}
        onBlur={onGridBlur}
      >
        <div role="row" className="r-dates-month-head">
          {names.map((name) => (
            <div key={name.long} role="columnheader" aria-label={name.long} className="truncate font-medium text-fg-muted">
              {name.short}
            </div>
          ))}
        </div>
        {weeks.map((week, r) => {
          const layout = rows[r];
          return (
            // Keyed by position, not by date: paging keeps the row and cell
            // elements, so focus is never dropped with a remounted cell.
            <div key={r} role="row" className="r-dates-month-week">
              {week.map((day, col) => {
                const events = layout?.events[col] ?? [];
                const hidden = layout?.hidden[col] ?? 0;
                const isToday = isSameDay(day, today);
                const active = isSameDay(day, date);
                const panelHere = open && panel !== null && isSameDay(panel.day, day);
                const inPick = picked !== null && rangeTouchesDay(picked, day);
                const name = [
                  dayName(day, locale),
                  isToday && labels.currentDay,
                  labels.dayEvents(events.length),
                  inPick && labels.inSelection,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <div
                    key={col}
                    role="gridcell"
                    tabIndex={active ? 0 : -1}
                    aria-label={name}
                    aria-current={isToday ? "date" : undefined}
                    aria-haspopup="dialog"
                    aria-expanded={panelHere}
                    aria-controls={panelHere ? panelId : undefined}
                    aria-selected={onSelectionChange ? inPick : undefined}
                    data-day={toISODate(day)}
                    data-outside={day.getMonth() !== month ? "" : undefined}
                    className="r-dates-month-cell focus-visible:focus-ring-inset @measure:min-h-(--r-dates-month-chips)"
                    onClick={onCellClick(day)}
                    onPointerDown={onSelectionChange ? onCellPointerDown(day) : undefined}
                  >
                    {bands.map(({ kind, range }) => {
                      const band = bandIn(range, week);
                      return (
                        band?.col === col && (
                          <span
                            key={kind}
                            aria-hidden
                            data-draft={kind}
                            data-selection-piece={kind === "selection" ? "" : undefined}
                            data-continues-before={band.before ? "" : undefined}
                            data-continues-after={band.after ? "" : undefined}
                            style={laneStyle(band.col, band.span, 0)}
                            className="r-dates-month-draft r-dates-event-draft"
                          />
                        )
                      );
                    })}
                    <span
                      aria-hidden
                      className={cn(
                        "r-dates-month-number",
                        isToday
                          ? "bg-accent font-semibold text-fg-on-accent"
                          : inPick
                            ? "text-fg-on-selection"
                            : day.getMonth() !== month
                              ? "text-fg-muted"
                              : "text-fg-primary",
                      )}
                    >
                      {/* The locale's own digits (Arabic-Indic in `ar-EG`). */}
                      {formatNumber(day.getDate(), { locale, useGrouping: false })}
                    </span>
                    <span aria-hidden className="r-dates-month-dots @measure:hidden">
                      {events.slice(0, MAX_DOTS).map((p) => (
                        <EventMark key={p.key} slot={p.event.slot} className="r-dates-event-dot" />
                      ))}
                      {events.length > MAX_DOTS && (
                        <span className="text-fg-secondary">
                          {formatNumber(events.length - MAX_DOTS, { locale, signDisplay: "always" })}
                        </span>
                      )}
                    </span>
                    {layout?.segments
                      .filter((seg) => seg.column === col)
                      .map((seg) => (
                        <MonthChip
                          key={seg.placed.key}
                          seg={seg}
                          day={day}
                          locale={locale}
                          labels={labels}
                          onEventClick={onEventClick}
                          className={classNames?.event}
                          moving={seg.placed.key === movingKey}
                          resizing={seg.placed.key === movingKey && draft?.kind === "resize"}
                          onMovePress={editable(seg.placed) ? onEventPointerDown(seg.placed, "move") : undefined}
                          onResizePress={
                            // The grip is on an all-day bar's last day: the segment the bar ends in.
                            editable(seg.placed) && seg.placed.allDay && !seg.continuesAfter
                              ? onEventPointerDown(seg.placed, "resize")
                              : undefined
                          }
                        />
                      ))}
                    {hidden > 0 && (
                      // A pointer target only: the cell (and its name's count) is the
                      // keyboard's way in. Its press opens the panel through the cell.
                      <button
                        type="button"
                        tabIndex={-1}
                        style={laneStyle(col, 1, maxEventsPerDay - 1)}
                        className="r-dates-month-chip group hidden @measure:block"
                      >
                        <span className="r-dates-month-chip-face border border-transparent font-medium text-fg-secondary group-hover:bg-fg-primary/8">
                          <span className="truncate">{labels.more(hidden)}</span>
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {present && panel && (
        // Disabled once closed: that hands focus back to the cell at once,
        // rather than after the exit transition.
        <FloatingFocusManager context={floating.context} modal={false} disabled={!open}>
          <div
            {...getFloatingProps({ onKeyDown: onEscape(close) })}
            ref={mergeRefs(panelRef, floating.refs.setFloating)}
            id={panelId}
            role="dialog"
            aria-labelledby={headingId}
            tabIndex={-1}
            // Leaving: on screen for its exit, but no longer interactive.
            inert={!open}
            style={floating.floatingStyles}
            className="r-dates-month-panel r-overlays-surface grid gap-r4 rounded-md border border-border bg-surface-0 p-r3 text-body-1 text-fg-primary shadow-md outline-none focus-visible:focus-ring"
          >
            <div id={headingId} className="break-words font-semibold">
              {dayName(panel.day, locale)}
            </div>
            {panelEvents && panelEvents.length > 0 ? (
              <ul className="grid">
                {panelEvents.map((p) => (
                  <li key={p.key} className="min-w-0">
                    <DayPanelEvent placed={p} locale={locale} labels={labels} onEventClick={onEventClick} className={classNames?.event} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-fg-secondary">{labels.dayEvents(0)}</p>
            )}
            {(onOpenDay || onSelectionChange) && (
              <div className="flex flex-wrap gap-r5">
                {onOpenDay && (
                  <Button variant="secondary" onClick={() => onOpenDay(panel.day)}>
                    {labels.openDay}
                  </Button>
                )}
                {onSelectionChange && (
                  <Button
                    variant="secondary"
                    // Closing hands focus back to the day's cell, as Escape does.
                    onClick={() => {
                      close();
                      commitPick(dayRange(panel.day, panel.day));
                    }}
                  >
                    {labels.newEvent}
                  </Button>
                )}
              </div>
            )}
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}

interface EventPartProps {
  locale: string;
  labels: EventCalendarLabels;
  onEventClick: EventViewProps["onEventClick"];
  className?: string;
}

/**
 * A segment in its lane: drawn in its first column's cell and spanning `span`
 * columns. Multi-day and all-day: a filled bar with the entity's stripe;
 * one timed day: a dot, the start time and the title.
 */
function MonthChip({
  seg,
  day,
  locale,
  labels,
  onEventClick,
  className,
  moving,
  resizing,
  onMovePress,
  onResizePress,
}: EventPartProps & {
  seg: LaneSegment;
  day: Date;
  /** Being moved or resized: drawn faded where it is until it lands. */
  moving: boolean;
  resizing: boolean;
  /** A press that may become a move; absent when the event cannot move. */
  onMovePress?: (event: PointerEvent<HTMLElement>) => void;
  /** A press on the end grip; absent where the segment has no grip. */
  onResizePress?: (event: PointerEvent<HTMLElement>) => void;
}) {
  const p = seg.placed;
  const bar = p.allDay || !isSameDay(p.firstDay, p.lastDay);
  const interactive = isInteractiveEvent(p, onEventClick);
  const showTime = !p.allDay && !seg.continuesBefore;
  return (
    <EventTarget
      placed={p}
      name={eventName(p, locale, labels, day)}
      onEventClick={onEventClick}
      // Out of the tab order: the day panel lists every event.
      tabIndex={-1}
      data-continues-before={seg.continuesBefore ? "" : undefined}
      data-continues-after={seg.continuesAfter ? "" : undefined}
      data-moving={moving ? "" : undefined}
      onPointerDown={onMovePress}
      // A link's own native drag would take the pointer from the move.
      onDragStart={onMovePress ? (event) => event.preventDefault() : undefined}
      style={laneStyle(seg.column, seg.span, seg.lane)}
      className={cn("r-dates-month-chip group hidden @measure:block", className)}
    >
      <span
        className={cn(
          "r-dates-month-chip-face border",
          bar ? "border-border bg-surface-1" : "border-transparent",
          interactive && "group-hover:border-border-strong",
        )}
      >
        <EventMark slot={p.event.slot} className={bar ? "r-dates-event-stripe" : "r-dates-event-dot"} />
        {showTime && <span className="shrink-0 text-fg-secondary">{formatTimeOfDay(p.start, locale)}</span>}
        {/* The title's own direction decides which end is cut (an English title on an RTL page). */}
        <span dir="auto" className="min-w-0 truncate font-medium text-fg-primary">{p.event.title}</span>
        {p.event.tone && <ToneGlyph tone={p.event.tone} className={cn("size-[1em] shrink-0", MARK_TEXT[p.event.tone])} />}
      </span>
      {onResizePress && (
        // Pointer only: the week and day views resize by keyboard.
        <span aria-hidden data-active={resizing ? "" : undefined} className="r-dates-month-grip" onPointerDown={onResizePress} />
      )}
    </EventTarget>
  );
}

/** One event in the day panel: its mark, title (and status glyph), and when. */
function DayPanelEvent({ placed: p, locale, labels, onEventClick, className }: EventPartProps & { placed: PlacedEvent }) {
  return (
    <EventTarget
      placed={p}
      name={eventName(p, locale, labels)}
      onEventClick={onEventClick}
      className={cn(
        "r-dates-month-panel-event flex min-h-hit w-full items-start gap-r5 rounded-sm border border-transparent px-r5 py-r6",
        isInteractiveEvent(p, onEventClick) && "hover:border-border-strong",
        className,
      )}
    >
      <EventMark slot={p.event.slot} className="r-dates-event-dot" />
      <span className="grid min-w-0 grow">
        <span className="flex min-w-0 items-center gap-r6">
          <span dir="auto" className="min-w-0 break-words font-medium text-fg-primary">{p.event.title}</span>
          {p.event.tone && <ToneGlyph tone={p.event.tone} className={cn("size-icon shrink-0", MARK_TEXT[p.event.tone])} />}
        </span>
        <span className="text-body-2 text-fg-secondary">{formatEventTime(p, locale, labels)}</span>
      </span>
    </EventTarget>
  );
}
