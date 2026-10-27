"use client";
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePressDrag } from "../../hooks/use-press-drag";
import { useRovingFocusWithin } from "../../hooks/use-roving-focus";
import { isRtl } from "../../util/direction";
import { formatNumber } from "../../util/format";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { MARK_TEXT, ToneGlyph } from "../../util/tone";
import { dayNumber, isSameDay, startOfDay, toISODate, weekdayNames } from "./date-core";
import {
  type DaySegment,
  daysBetween,
  drawnEnd,
  inAllDayLane,
  type LaneSegment,
  layoutDay,
  layoutRow,
  minuteOfDay,
  type PlacedEvent,
} from "./event-core";
import {
  type CalendarEventChange,
  type CalendarRange,
  describeRange,
  isEditableEvent,
  moveByDays,
  moveToSlot,
  rangeOf,
  resizeToDay,
  resizeToSlot,
  sameRange,
} from "./event-edit";
import { TimeGridSlots } from "./TimeGridSlots";
import {
  dayName,
  EventMark,
  EventTarget,
  type EventViewProps,
  eventName,
  formatEventTime,
  formatTimeOfDay,
  isInteractiveEvent,
  periodDays,
} from "./event-parts";
import { dayAtX, minuteAtY, slotAt } from "./time-grid-geometry";
import { keepsKind, keyedTarget, placedAt, pressOffset, startUnder, touchesDays } from "./time-grid-edit";

export interface EventTimeGridProps extends EventViewProps {
  /** The hour (0–23) scrolled to the top when the grid mounts. */
  scrollToHour: number;
}

/** The all-day row shows this many lanes before a day's last one turns into "+n more". */
const ALL_DAY_LANES = 3;
/**
 * A block drawn shorter than this many minutes puts its time beside its title
 * on one line: at compact density two lines no longer fit in 30 minutes (one
 * `--ROW-H`), and a line cut in half reads worse than an ellipsis.
 */
const TWO_LINE_MINUTES = 45;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** A timed block in the grid: its day column and its place in that day. */
interface Block {
  /** Unique in the view: one event over midnight is a block on each of its days. */
  id: string;
  dayIndex: number;
  seg: DaySegment;
  interactive: boolean;
}

/** The block among `candidates` whose start is nearest `minute` (the earlier on a tie). */
function nearest(candidates: readonly Block[], minute: number): Block | undefined {
  let best: Block | undefined;
  for (const b of candidates) {
    if (!best || Math.abs(b.seg.startMinute - minute) < Math.abs(best.seg.startMinute - minute)) best = b;
  }
  return best;
}

/**
 * An event being moved or resized, by pointer or by keys (one at a time): it
 * stays drawn where it is, faded, and a draft shows `target` until the drop.
 */
interface Edit {
  p: PlacedEvent;
  /** The element it was picked up from: a block's id, or an all-day bar's event key. */
  source: string;
  how: "keyboard" | "pointer";
  /** A pointer drag's gesture. The keyboard's is read off the target at the drop. */
  kind: CalendarEventChange["kind"];
  target: CalendarRange;
  /** The all-day lane its draft is drawn in. */
  lane: number;
  /** A pointer move's hold: minutes below the event's start (a block), or the day pressed (a bar). */
  offset: number;
  day0: Date;
}

/** What a press on an event (or its grip) is about. */
interface Press {
  p: PlacedEvent;
  source: string;
  kind: CalendarEventChange["kind"];
  /** The block's day; a bar's first day in view. */
  day: Date;
  lane: number;
}

/** The handlers and state an editable event's element takes. */
interface EditBindings {
  moving: boolean;
  hintId: string;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  /** Absent where the event's end is not in view (it goes on past it). */
  onGripPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLElement>) => void;
  onBlur: () => void;
}

/**
 * The week and day views: the days of `period` side by side as a time grid,
 * two `--ROW-H` an hour, with an all-day row above and an hour gutter at the
 * inline start. The grid is its own scroller (both axes), a named focusable
 * region; its header, all-day row and gutter stick. Overlapping events share
 * their day's width; the now line runs across today.
 *
 * The timed blocks are one tab stop: ArrowUp / ArrowDown within a day,
 * ArrowLeft / ArrowRight to the nearest start on the neighbouring day
 * (mirrored right to left), Home / End to the view's first and last. Moving
 * onto another day makes it the active day.
 *
 * With `onEventChange`, an editable event moves by a drag of its body and
 * resizes by a drag of its end's grip (a block's bottom edge, an all-day
 * event's inline end), snapped to `slotMinutes` or whole days. By keys, Space
 * picks it up, arrows move it (a block: a slot up or down, a day sideways;
 * Shift with an arrow moves its end), Enter or Space drops it, Escape or
 * leaving it puts it back. A target stays on the view's days, a block stays a
 * block and a bar a bar.
 */
export function EventTimeGrid({
  placed,
  date,
  onDateChange,
  period,
  title,
  weekStart,
  locale,
  now,
  labels,
  onEventClick,
  onOpenDay,
  classNames,
  scrollToHour,
  slotMinutes,
  selection,
  onSelectionChange,
  onEventChange,
  announce,
}: EventTimeGridProps) {
  const baseId = useId();
  const regionRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  const dayRowRef = useRef<HTMLDivElement>(null);
  const allDayRef = useRef<HTMLDivElement>(null);
  const blockEls = useRef(new Map<string, HTMLElement>());

  const periodStart = period.start.getTime();
  const periodEnd = period.end.getTime();
  const days = useMemo(
    () => periodDays({ start: new Date(periodStart), end: new Date(periodEnd) }),
    [periodStart, periodEnd],
  );
  const today = startOfDay(new Date(now));
  const weekdays = weekdayNames(locale, weekStart);
  const dayHeaderId = (i: number) => `${baseId}-day-${i}`;

  // ── The timed blocks ──────────────────────────────────────────────────────
  const columns = useMemo(() => days.map((day) => layoutDay(placed, day)), [days, placed]);
  const nav = useMemo(
    () =>
      columns.map((segs, dayIndex) =>
        segs
          .map(
            (seg): Block => ({
              id: `${toISODate(days[dayIndex] as Date)}|${seg.placed.key}`,
              dayIndex,
              seg,
              interactive: isInteractiveEvent(seg.placed, onEventClick, isEditableEvent(seg.placed, onEventChange)),
            }),
          )
          .sort((a, b) => a.seg.startMinute - b.seg.startMinute || a.seg.column - b.seg.column),
      ),
    [columns, days, onEventClick, onEventChange],
  );
  const stops = useMemo(() => nav.map((list) => list.filter((b) => b.interactive)), [nav]);
  const flat = useMemo(() => stops.flat(), [stops]);

  const [stopId, setStopId] = useState<string | null>(null);
  const stop =
    flat.find((b) => b.id === stopId) ??
    flat.find((b) => dayNumber(days[b.dayIndex] as Date) >= dayNumber(date)) ??
    flat[flat.length - 1];

  const moveTo = useCallback(
    (target: Block | undefined, from: Block) => {
      if (!target || target.id === from.id) return;
      setStopId(target.id);
      const el = blockEls.current.get(target.id);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      if (target.dayIndex !== from.dayIndex) onDateChange(days[target.dayIndex] as Date);
    },
    [days, onDateChange],
  );

  const onBlockKeyDown = (event: KeyboardEvent<HTMLElement>, from: Block) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const inDay = stops[from.dayIndex] ?? [];
    const at = inDay.indexOf(from);
    const acrossDays = (step: 1 | -1) => {
      for (let d = from.dayIndex + step; d >= 0 && d < stops.length; d += step) {
        const found = nearest(stops[d] ?? [], from.seg.startMinute);
        if (found) return found;
      }
      return undefined;
    };
    const rtl = isRtl(event.currentTarget);
    let target: Block | undefined;
    switch (event.key) {
      case "ArrowDown":
        target = inDay[at + 1];
        break;
      case "ArrowUp":
        target = inDay[at - 1];
        break;
      case "ArrowRight":
        target = acrossDays(rtl ? -1 : 1);
        break;
      case "ArrowLeft":
        target = acrossDays(rtl ? 1 : -1);
        break;
      case "Home":
        target = flat[0];
        break;
      case "End":
        target = flat[flat.length - 1];
        break;
      default:
        return;
    }
    // At an edge the key is still the grid's: the region must not scroll under focus.
    event.preventDefault();
    moveTo(target, from);
  };

  // ── Moving and resizing ───────────────────────────────────────────────────
  const bodyRef = useRef<HTMLDivElement>(null);
  const [edit, setEditState] = useState<Edit | null>(null);
  // Read by the drag's and the keys' handlers, which run between renders.
  const editRef = useRef<Edit | null>(null);
  const setEdit = (next: Edit | null) => {
    editRef.current = next;
    setEditState(next);
  };
  const hintId = `${baseId}-edit-hint`;

  /** A pointer drag's gesture; for the keys, a resize when only the end moved. */
  const kindOf = (e: Edit): CalendarEventChange["kind"] =>
    e.how === "pointer" || e.target.start.getTime() !== rangeOf(e.p).start.getTime() ? e.kind : "resize";

  /** Reports a drop somewhere new (once) and says so; `false` where it started. */
  const commit = (e: Edit) => {
    if (!onEventChange || sameRange(e.target, rangeOf(e.p))) return false;
    onEventChange({ event: e.p.event, kind: kindOf(e), ...e.target });
    announce(labels.dropped(e.p.event.title, describeRange(e.target, locale, labels)));
    return true;
  };

  /** Where the pointer at (`x`, `y`) takes the event, from the geometry as laid out. */
  const pointerTarget = (e: Edit, body: HTMLElement, x: number, y: number): CalendarRange | null => {
    if (inAllDayLane(e.p)) {
      const day = dayAtX(body, x);
      if (!day) return null;
      return e.kind === "resize" ? resizeToDay(e.p, day) : moveByDays(e.p, daysBetween(e.day0, day));
    }
    const slot = slotAt(body, x, y, slotMinutes);
    if (!slot) return null;
    return e.kind === "resize" ? resizeToSlot(e.p, slot, slotMinutes) : moveToSlot(e.p, startUnder(slot, e.offset));
  };

  const drag = usePressDrag<Press>({
    enabled: Boolean(onEventChange),
    scrollers: () => [regionRef.current],
    onStart: ({ payload: press, x0, y0 }) => {
      const body = bodyRef.current;
      if (editRef.current || !body) return false;
      let offset = 0;
      let day0 = press.day;
      if (inAllDayLane(press.p)) {
        const day = dayAtX(body, x0);
        if (!day) return false;
        day0 = day;
      } else if (press.kind === "move") {
        const minute = minuteAtY(body, y0);
        if (minute === null) return false;
        offset = pressOffset(press.p, press.day, minute, slotMinutes);
      }
      setEdit({ ...press, how: "pointer", target: rangeOf(press.p), offset, day0 });
    },
    onMove: ({ x, y }) => {
      const e = editRef.current;
      const body = bodyRef.current;
      if (e?.how !== "pointer" || !body) return;
      const target = pointerTarget(e, body, x, y);
      if (target && keepsKind(e.p, target) && !sameRange(target, e.target)) setEdit({ ...e, target });
    },
    onEnd: (_, how) => {
      const e = editRef.current;
      if (e?.how !== "pointer") return;
      setEdit(null);
      if (how === "drop") commit(e);
    },
  });
  const rootRef = useMemo(() => mergeRefs(regionRef, drag.rootRef), [drag.rootRef]);

  // A drop re-renders the event in its new place (often another day's column),
  // which drops focus to <body>: give it back by the event's key once the app
  // has applied the change, and only if focus did fall (Kanban's rule).
  const refocusKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = refocusKey.current;
    refocusKey.current = null;
    const active = document.activeElement;
    if (!key || (active && active !== document.body)) return;
    const events = regionRef.current?.querySelectorAll<HTMLElement>("[data-event]") ?? [];
    [...events].find((el) => el.dataset.event === key && el.matches("a[href], button"))?.focus();
  }, [placed]);

  // The keys move the draft, maybe off screen: keep it in view.
  useLayoutEffect(() => {
    if (edit?.how !== "keyboard") return;
    regionRef.current?.querySelector<HTMLElement>(".r-dates-timegrid-draft, .r-dates-timegrid-bar-draft")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [edit]);

  const cancelGrab = (e: Edit) => {
    setEdit(null);
    announce(labels.cancelled(e.p.event.title));
  };

  // Space picks up and drops on keydown; its keyup would press the button.
  const swallowSpaceUp = useRef(false);

  /** The grab's keys on an event; `false` leaves the key to the roving tab stop. */
  const onEditKeyDown = (event: KeyboardEvent<HTMLElement>, press: Press): boolean => {
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    const e = editRef.current;
    if (!e) {
      if (event.key !== " " || event.shiftKey || !isEditableEvent(press.p, onEventChange)) return false;
      event.preventDefault();
      swallowSpaceUp.current = true;
      setEdit({ ...press, how: "keyboard", target: rangeOf(press.p), offset: 0, day0: press.day });
      announce(labels.grabbed(press.p.event.title));
      return true;
    }
    if (e.how !== "keyboard" || e.source !== press.source) return true;
    switch (event.key) {
      case " ":
      case "Enter": {
        event.preventDefault();
        swallowSpaceUp.current = event.key === " ";
        setEdit(null);
        if (commit(e)) refocusKey.current = e.p.key;
        else announce(labels.cancelled(e.p.event.title));
        return true;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        cancelGrab(e);
        return true;
      default: {
        if (!event.key.startsWith("Arrow")) return true;
        event.preventDefault();
        const rtl = isRtl(event.currentTarget);
        const target = keyedTarget(e.p, e.target, { key: event.key, shift: event.shiftKey, rtl }, slotMinutes);
        // It may leave the view's days only partly: the draft must stay on screen.
        if (target && touchesDays(target, days) && !sameRange(target, e.target)) setEdit({ ...e, target });
        return true;
      }
    }
  };

  /** The bindings for an event that can move; `undefined` for one that cannot. */
  const bindings = (press: Press, endsInView: boolean): EditBindings | undefined => {
    if (!isEditableEvent(press.p, onEventChange)) return undefined;
    return {
      moving: edit?.p.key === press.p.key,
      hintId,
      onPointerDown: (event) => drag.onPointerDown(event, press),
      onGripPointerDown: endsInView
        ? (event) => drag.onPointerDown(event, { ...press, kind: "resize" })
        : undefined,
      onKeyUp: (event) => {
        if (event.key !== " " || !swallowSpaceUp.current) return;
        swallowSpaceUp.current = false;
        event.preventDefault();
      },
      onBlur: () => {
        const e = editRef.current;
        if (e?.how === "keyboard" && e.source === press.source) cancelGrab(e);
      },
    };
  };

  // Where the edit would land, drawn as drafts: a block's on each day it
  // covers, a bar's across its days in its own lane.
  const draft = edit ? placedAt(edit.p, edit.target) : null;
  const draftTime = draft ? formatEventTime(draft, locale, labels) : "";
  const barDraft = draft && inAllDayLane(draft) ? layoutRow([draft], days[0] as Date, days.length, 1).segments[0] : undefined;

  // ── The all-day row ───────────────────────────────────────────────────────
  // Unfolded for one period only: paging folds it again.
  const [unfoldedAt, setUnfoldedAt] = useState<number | null>(null);
  const unfolded = unfoldedAt === periodStart;
  const folded = useMemo(
    () => layoutRow(placed, days[0] as Date, days.length, ALL_DAY_LANES, inAllDayLane),
    [placed, days],
  );
  const full = useMemo(
    () => layoutRow(placed, days[0] as Date, days.length, Number.MAX_SAFE_INTEGER, inAllDayLane),
    [placed, days],
  );
  const canUnfold = folded.hidden.some((n) => n > 0);

  // A pick under way in the slots replaces the picked range, here too.
  const [slotsDrafting, setSlotsDrafting] = useState(false);
  // The picked range, when it is all-day and touches these days: its first and last column.
  const allDaySelection = useMemo(() => {
    if (!selection?.allDay || slotsDrafting) return null;
    const first = daysBetween(days[0] as Date, selection.start);
    const last = daysBetween(days[0] as Date, selection.end);
    const from = Math.max(0, first);
    const to = Math.min(days.length - 1, last);
    return from > to ? null : { from, to, continuesBefore: first < 0, continuesAfter: last > days.length - 1 };
  }, [selection, days, slotsDrafting]);
  const row = unfolded ? full : folded;
  const deepest = row.segments.reduce((max, seg) => Math.max(max, seg.lane + 1), 0);
  const lanes = Math.max(1, unfolded ? deepest + 1 : canUnfold ? ALL_DAY_LANES : deepest);

  // Focus after a fold or unfold: the button pressed is gone.
  const pendingFocus = useRef<"unfolded" | "folded" | null>(null);
  const unfoldDay = useRef(0);
  useLayoutEffect(() => {
    const want = pendingFocus.current;
    const rowEl = allDayRef.current;
    if (!want || !rowEl) return;
    pendingFocus.current = null;
    if (want === "folded") {
      rowEl.querySelector<HTMLElement>("[data-allday-more]")?.focus();
      return;
    }
    // The first event the fold hid on the day that was pressed, else "Show fewer".
    const shown = new Set(folded.segments.map((seg) => seg.placed.key));
    const col = unfoldDay.current;
    const revealed = full.segments
      .filter((seg) => !shown.has(seg.placed.key) && col >= seg.column && col < seg.column + seg.span)
      .sort((a, b) => a.lane - b.lane)
      .map((seg) => [...rowEl.querySelectorAll<HTMLElement>("[data-event]")].find((el) => el.dataset.event === seg.placed.key))
      .find((el) => el?.matches("a[href], button"));
    (revealed ?? rowEl.querySelector<HTMLElement>("[data-allday-fewer]"))?.focus();
  });

  // ── Day headers: one tab stop when they open days ─────────────────────────
  const opensDays = Boolean(onOpenDay) && days.length > 1;
  const activeIso = toISODate(date);
  const { onKeyDown: onDayRowKeyDown } = useRovingFocusWithin(dayRowRef, {
    orientation: "horizontal",
    loop: false,
    enabled: opensDays,
    preferredStop: (items) => items.find((el) => el.dataset.day === activeIso),
  });

  // ── Scrolling ─────────────────────────────────────────────────────────────
  // The sticky header and gutter cover the scrollport's start edges: published
  // as scroll padding, so a block scrolled into view lands clear of both.
  useLayoutEffect(() => {
    const region = regionRef.current;
    const head = headRef.current;
    const corner = cornerRef.current;
    if (!region || !head || !corner) return;
    const write = () => {
      region.style.setProperty("--r-dates-head", String(head.offsetHeight));
      region.style.setProperty("--r-dates-gutter", String(corner.offsetWidth));
    };
    write();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(write);
    observer.observe(head);
    observer.observe(corner);
    return () => observer.disconnect();
  }, []);

  // `scrollToHour` at the top, under the header: measured from the hour's own
  // line, so density, input and a theme's row height all count. Instant.
  const periodKey = `${periodStart}:${days.length}`;
  useLayoutEffect(() => {
    const region = regionRef.current;
    const head = headRef.current;
    const line = region?.querySelector<HTMLElement>(`[data-hour="${scrollToHour}"]`);
    if (!region || !head || !line) return;
    const offset = line.getBoundingClientRect().top - head.getBoundingClientRect().bottom;
    region.scrollTop = Math.max(0, region.scrollTop + offset);
  }, [periodKey, scrollToHour]);

  const hourLabel = (hour: number) => formatTimeOfDay(new Date(2000, 0, 3, hour).getTime(), locale);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={title}
      tabIndex={0}
      data-timegrid=""
      className="r-dates-timegrid rounded-md border border-border bg-surface-0"
    >
      <div className="r-dates-timegrid-grid" style={{ "--r-dates-days": days.length } as CSSProperties}>
        <div ref={headRef} data-timegrid-head="" className="r-dates-timegrid-head border-b border-border bg-surface-0">
          <div ref={dayRowRef} className="r-dates-timegrid-dayrow" onKeyDown={opensDays ? onDayRowKeyDown : undefined}>
            <div ref={cornerRef} className="r-dates-timegrid-corner border-e border-border bg-surface-0" />
            {days.map((day, i) => {
              const isToday = isSameDay(day, today);
              const name = isToday ? `${dayName(day, locale)}, ${labels.currentDay}` : dayName(day, locale);
              const face = (
                <>
                  <span className="text-body-3 text-fg-secondary">{weekdays[(day.getDay() - weekStart + 7) % 7]?.short}</span>
                  <span
                    data-today={isToday ? "" : undefined}
                    className={cn("r-dates-timegrid-date rounded-full text-h5", isToday && "bg-accent text-fg-on-accent")}
                  >
                    {formatNumber(day.getDate(), { locale, useGrouping: false })}
                  </span>
                </>
              );
              const cell = "flex min-h-hit min-w-0 flex-col items-center justify-center gap-r6 py-r5";
              // The day said in full, which names a header button and describes the day's "+n more".
              const said = (
                <span id={dayHeaderId(i)} className="sr-only">
                  {name}
                </span>
              );
              const shown = (
                <span aria-hidden className="contents">
                  {face}
                </span>
              );
              return (
                <div key={toISODate(day)} className="r-dates-timegrid-dayhead min-w-0" style={{ gridColumn: i + 2 }}>
                  {opensDays && onOpenDay ? (
                    <button
                      type="button"
                      data-day={toISODate(day)}
                      aria-labelledby={dayHeaderId(i)}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => onOpenDay(day)}
                      className={cn(cell, "w-full cursor-pointer rounded-md hover:bg-fg-primary/8")}
                    >
                      {said}
                      {shown}
                    </button>
                  ) : (
                    <div data-day={toISODate(day)} className={cell}>
                      {said}
                      {shown}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            ref={allDayRef}
            data-allday=""
            className="r-dates-timegrid-allday border-t border-border text-body-3"
            style={{ "--r-dates-lanes": lanes } as CSSProperties}
          >
            <div className="r-dates-timegrid-corner flex items-center border-e border-border bg-surface-0 px-r5 text-fg-secondary">
              {labels.allDay}
            </div>
            {days.map((day, i) => (
              <div key={toISODate(day)} aria-hidden className="r-dates-timegrid-allday-cell" style={{ gridColumn: i + 2 }} />
            ))}
            {/* A picked all-day range (from the month, or the day panel's New event) is drawn
                across its days here, under the bars; a timed one is the slots' to draw. */}
            {allDaySelection && (
              <div
                aria-hidden
                data-allday-selection=""
                data-continues-before={allDaySelection.continuesBefore ? "" : undefined}
                data-continues-after={allDaySelection.continuesAfter ? "" : undefined}
                className="r-dates-event-draft r-dates-timegrid-allday-selection"
                style={{ gridColumn: `${allDaySelection.from + 2} / span ${allDaySelection.to - allDaySelection.from + 1}` }}
              />
            )}
            {row.segments.map((seg) => {
              const press: Press = {
                p: seg.placed,
                source: seg.placed.key,
                kind: "move",
                day: days[seg.column] as Date,
                lane: seg.lane,
              };
              // Only an all-day event's last day moves; a timed one a day or longer keeps its length.
              const edits = bindings(press, seg.placed.allDay && !seg.continuesAfter);
              return (
                <AllDayBar
                  key={seg.placed.key}
                  seg={seg}
                  day={press.day}
                  locale={locale}
                  labels={labels}
                  onEventClick={onEventClick}
                  className={classNames?.event}
                  edits={edits}
                  onKeyDown={edits ? (event) => void onEditKeyDown(event, press) : undefined}
                />
              );
            })}
            {barDraft && edit && (
              <div
                aria-hidden
                data-draft={kindOf(edit)}
                data-continues-before={barDraft.continuesBefore ? "" : undefined}
                data-continues-after={barDraft.continuesAfter ? "" : undefined}
                className="r-dates-event-draft r-dates-timegrid-bar-draft flex min-w-0 items-center gap-r5 px-r5"
                style={{ gridColumn: `${barDraft.column + 2} / span ${barDraft.span}`, gridRow: edit.lane + 1 }}
              >
                <span dir="auto" className="min-w-0 truncate font-medium">{edit.p.event.title}</span>
              </div>
            )}
            {!unfolded &&
              folded.hidden.map((count, i) =>
                count > 0 ? (
                  <button
                    key={`more-${i}`}
                    type="button"
                    data-allday-more=""
                    data-print="hide"
                    aria-expanded={false}
                    aria-describedby={dayHeaderId(i)}
                    onClick={() => {
                      unfoldDay.current = i;
                      pendingFocus.current = "unfolded";
                      setUnfoldedAt(periodStart);
                    }}
                    className="r-dates-timegrid-more min-w-0 truncate rounded-sm px-r5 text-start font-medium text-fg-secondary hover:bg-fg-primary/8"
                    style={{ gridColumn: i + 2, gridRow: ALL_DAY_LANES }}
                  >
                    {labels.more(count)}
                  </button>
                ) : null,
              )}
            {unfolded && (
              <button
                type="button"
                data-allday-fewer=""
                data-print="hide"
                aria-expanded
                onClick={() => {
                  pendingFocus.current = "folded";
                  setUnfoldedAt(null);
                }}
                className="r-dates-timegrid-more justify-self-start rounded-sm px-r5 font-medium text-fg-secondary hover:bg-fg-primary/8"
                style={{ gridColumn: "2 / -1", gridRow: lanes }}
              >
                {labels.showFewer}
              </button>
            )}
          </div>
        </div>

        <div ref={bodyRef} className="r-dates-timegrid-body">
          {HOURS.map((hour) => (
            <div key={hour} aria-hidden data-hour={hour} className="r-dates-timegrid-line" style={{ gridRow: hour + 1 }} />
          ))}
          {/* Under the events: the slots a range is picked on (with onSelectionChange). */}
          {onSelectionChange && (
            <TimeGridSlots
              days={days}
              date={date}
              onDateChange={onDateChange}
              slotMinutes={slotMinutes}
              selection={selection}
              onSelectionChange={onSelectionChange}
              scrollToHour={scrollToHour}
              locale={locale}
              labels={labels}
              announce={announce}
              regionRef={regionRef}
              onDraftChange={setSlotsDrafting}
            />
          )}
          {days.map((day, i) => {
            const nowMinute = minuteOfDay(now, day);
            const overlap = (columns[i] ?? []).reduce((max, seg) => Math.max(max, seg.columns), 1);
            const dayDraft = draft ? layoutDay([draft], day)[0] : undefined;
            return (
              <div
                key={toISODate(day)}
                data-day={toISODate(day)}
                className="r-dates-timegrid-day"
                style={{ gridColumn: i + 2, "--r-dates-overlap": overlap } as CSSProperties}
              >
                {(nav[i] ?? []).map((block) => {
                  const press: Press = { p: block.seg.placed, source: block.id, kind: "move", day, lane: 0 };
                  return (
                    <TimedBlock
                      key={block.id}
                      block={block}
                      day={day}
                      locale={locale}
                      labels={labels}
                      onEventClick={onEventClick}
                      className={classNames?.event}
                      tabIndex={block.interactive ? (block === stop ? 0 : -1) : undefined}
                      blockRef={(el) => {
                        if (el) blockEls.current.set(block.id, el);
                        else blockEls.current.delete(block.id);
                      }}
                      onFocus={block.interactive ? () => setStopId(block.id) : undefined}
                      onKeyDown={
                        block.interactive
                          ? (event) => {
                              if (!onEditKeyDown(event, press)) onBlockKeyDown(event, block);
                            }
                          : undefined
                      }
                      edits={bindings(press, !block.seg.continuesAfter)}
                    />
                  );
                })}
                {dayDraft && edit && (
                  <div
                    aria-hidden
                    data-draft={kindOf(edit)}
                    data-continues-before={dayDraft.continuesBefore ? "" : undefined}
                    data-continues-after={dayDraft.continuesAfter ? "" : undefined}
                    className="r-dates-event-draft r-dates-timegrid-draft flex min-w-0 flex-col overflow-hidden px-r6 py-r6 text-body-3"
                    style={{ "--r-dates-start": dayDraft.startMinute, "--r-dates-end": drawnEnd(dayDraft) } as CSSProperties}
                  >
                    <span dir="auto" className="min-w-0 truncate font-semibold">{edit.p.event.title}</span>
                    <span className="min-w-0 truncate">{draftTime}</span>
                  </div>
                )}
                {nowMinute !== null && (
                  <div
                    aria-hidden
                    data-now=""
                    className="r-dates-timegrid-now"
                    style={{ "--r-dates-now": nowMinute } as CSSProperties}
                  />
                )}
              </div>
            );
          })}
          {/* After the days, so the sticky gutter paints over blocks scrolled under it. */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              aria-hidden
              data-timegrid-hour=""
              className="r-dates-timegrid-hour border-e border-border bg-surface-0 px-r5 pt-r6 text-end text-body-3 text-fg-secondary"
              style={{ gridRow: hour + 1 }}
            >
              {hourLabel(hour)}
            </div>
          ))}
        </div>
      </div>
      {onEventChange && (
        <span id={hintId} hidden>
          {labels.editHint}
        </span>
      )}
    </div>
  );
}

type SharedEventProps = Pick<EventViewProps, "locale" | "labels" | "onEventClick"> & { className?: string };

/** Its status glyph, a line tall, before the title. */
function StatusGlyph({ placed }: { placed: PlacedEvent }) {
  const tone = placed.event.tone;
  if (!tone) return null;
  return (
    <span aria-hidden className={cn("flex h-[1lh] shrink-0 items-center [&>svg]:size-icon", MARK_TEXT[tone])}>
      <ToneGlyph tone={tone} />
    </span>
  );
}

/** What an editable event's element carries: the drag's press, the grab's keys, the hint, its faded state. */
function editAttributes(edits: EditBindings | undefined, interactive: boolean) {
  if (!edits) return {};
  return {
    "data-moving": edits.moving ? "" : undefined,
    "aria-describedby": interactive ? edits.hintId : undefined,
    onPointerDown: edits.onPointerDown,
    onKeyUp: edits.onKeyUp,
    onBlur: edits.onBlur,
    // A link's native drag would take the pointer (pointercancel).
    onDragStart: (event: DragEvent) => event.preventDefault(),
  };
}

/** The resize grip on the event's end: pointer only (the keys have Shift with an arrow). */
function Grip({ edits, className }: { edits: EditBindings | undefined; className: string }) {
  if (!edits?.onGripPointerDown) return null;
  return <span aria-hidden data-grip="" data-print="hide" className={className} onPointerDown={edits.onGripPointerDown} />;
}

function AllDayBar({
  seg,
  day,
  locale,
  labels,
  onEventClick,
  className,
  edits,
  onKeyDown,
}: SharedEventProps & {
  seg: LaneSegment;
  day: Date;
  edits: EditBindings | undefined;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const p = seg.placed;
  // `edits` exists exactly when the bar can be moved, which makes it a button.
  const interactive = isInteractiveEvent(p, onEventClick, Boolean(edits));
  return (
    <EventTarget
      placed={p}
      name={eventName(p, locale, labels, day)}
      onEventClick={onEventClick}
      editable={Boolean(edits)}
      {...editAttributes(edits, interactive)}
      onKeyDown={onKeyDown}
      data-continues-before={seg.continuesBefore ? "" : undefined}
      data-continues-after={seg.continuesAfter ? "" : undefined}
      style={{ gridColumn: `${seg.column + 2} / span ${seg.span}`, gridRow: seg.lane + 1 }}
      className={cn(
        "r-dates-timegrid-bar flex items-center gap-r5 overflow-hidden border border-border bg-surface-1 pe-r5 text-fg-primary",
        interactive && "hover:border-border-strong",
        className,
      )}
    >
      <EventMark slot={p.event.slot} className="r-dates-event-stripe" />
      <StatusGlyph placed={p} />
      <span dir="auto" className="min-w-0 truncate font-medium">{p.event.title}</span>
      <Grip edits={edits} className="r-dates-timegrid-bar-grip" />
    </EventTarget>
  );
}

function TimedBlock({
  block,
  day,
  locale,
  labels,
  onEventClick,
  className,
  tabIndex,
  blockRef,
  onFocus,
  onKeyDown,
  edits,
}: SharedEventProps & {
  block: Block;
  day: Date;
  tabIndex: number | undefined;
  blockRef: (el: HTMLElement | null) => void;
  onFocus?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  edits: EditBindings | undefined;
}) {
  const { seg } = block;
  const p = seg.placed;
  const end = drawnEnd(seg);
  const time = formatEventTime(p, locale, labels);
  const twoLines = end - seg.startMinute >= TWO_LINE_MINUTES;
  return (
    <EventTarget
      ref={blockRef}
      placed={p}
      name={eventName(p, locale, labels, day)}
      onEventClick={onEventClick}
      editable={Boolean(edits)}
      tabIndex={tabIndex}
      {...editAttributes(edits, block.interactive)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      data-block={block.id}
      data-continues-before={seg.continuesBefore ? "" : undefined}
      data-continues-after={seg.continuesAfter ? "" : undefined}
      style={
        {
          "--r-dates-start": seg.startMinute,
          "--r-dates-end": end,
          "--r-dates-column": seg.column,
          "--r-dates-columns": seg.columns,
          "--r-dates-span": seg.span,
        } as CSSProperties
      }
      className={cn(
        "r-dates-timegrid-block flex gap-r5 overflow-hidden border border-border bg-surface-1 py-r6 pe-r6 text-body-3 text-fg-primary focus-visible:z-raised",
        block.interactive && "hover:border-border-strong",
        className,
      )}
    >
      <EventMark slot={p.event.slot} className="r-dates-event-stripe" />
      {twoLines ? (
        // A line each, cut with an ellipsis: three overlapping blocks share a
        // day's width, and a title broken letter by letter reads worse.
        <span className="flex min-w-0 grow flex-col">
          <span className="flex min-w-0 items-start gap-r6">
            <StatusGlyph placed={p} />
            <span dir="auto" className="min-w-0 truncate font-semibold">{p.event.title}</span>
          </span>
          <span className="min-w-0 truncate text-fg-secondary">{time}</span>
        </span>
      ) : (
        <span className="flex min-w-0 grow items-start gap-r6">
          <StatusGlyph placed={p} />
          {/* The title's own direction decides which end is cut (an English title on an RTL page). */}
          <span dir="auto" className="min-w-0 truncate">
            <span className="font-semibold">{p.event.title}</span> <span className="text-fg-secondary">{time}</span>
          </span>
        </span>
      )}
      <Grip edits={edits} className="r-dates-timegrid-grip" />
    </EventTarget>
  );
}
