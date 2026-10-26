"use client";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FloatingFocusManager, useDismiss, useFloating, useInteractions } from "../../hooks/use-floating";
import { isRtl } from "../../util/direction";
import { formatNumber } from "../../util/format";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { MARK_TEXT, ToneGlyph } from "../../util/tone";
import { onEscape, topLayerExit, useExitPresence } from "../overlays/internal";
import { Button } from "../primitives";
import { addDays, addMonths, isSameDay, parseISODate, startOfMonth, toISODate, weekdayNames } from "./date-core";
import { type LaneSegment, layoutRow, monthWeeks, type PlacedEvent } from "./event-core";
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

/** A narrow cell draws this many dots, then "+n". */
const MAX_DOTS = 3;

/** A part placed over the row's cells: its first column, its span and its lane. */
const laneStyle = (column: number, span: number, lane: number) =>
  ({ "--r-dates-col": column, "--r-dates-span": span, "--r-dates-lane": lane }) as CSSProperties;

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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = event.target as HTMLElement;
    const from = cell.getAttribute("role") === "gridcell" ? parseISODate(cell.dataset.day ?? "") : null;
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
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

  return (
    <div
      ref={rootRef}
      className="r-dates-month-view"
      style={{ "--r-dates-lanes": maxEventsPerDay } as CSSProperties}
    >
      <div
        ref={floating.refs.setReference}
        role="grid"
        aria-label={title}
        className="r-dates-month-grid text-body-3"
        onKeyDown={onKeyDown}
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
                const name = [dayName(day, locale), isToday && labels.currentDay, labels.dayEvents(events.length)]
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
                    data-day={toISODate(day)}
                    data-outside={day.getMonth() !== month ? "" : undefined}
                    className="r-dates-month-cell focus-visible:focus-ring-inset @measure:min-h-(--r-dates-month-chips)"
                    onClick={onCellClick(day)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "r-dates-month-number",
                        isToday
                          ? "bg-accent font-semibold text-fg-on-accent"
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
            {onOpenDay && (
              <Button variant="secondary" className="justify-self-start" onClick={() => onOpenDay(panel.day)}>
                {labels.openDay}
              </Button>
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
function MonthChip({ seg, day, locale, labels, onEventClick, className }: EventPartProps & { seg: LaneSegment; day: Date }) {
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
