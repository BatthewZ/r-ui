"use client";
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRovingFocusWithin } from "../../hooks/use-roving-focus";
import { isRtl } from "../../util/direction";
import { formatNumber } from "../../util/format";
import { cn } from "../../util/style";
import { MARK_TEXT, ToneGlyph } from "../../util/tone";
import { dayNumber, isSameDay, startOfDay, toISODate, weekdayNames } from "./date-core";
import {
  type DaySegment,
  drawnEnd,
  inAllDayLane,
  type LaneSegment,
  layoutDay,
  layoutRow,
  minuteOfDay,
  type PlacedEvent,
} from "./event-core";
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
              interactive: isInteractiveEvent(seg.placed, onEventClick),
            }),
          )
          .sort((a, b) => a.seg.startMinute - b.seg.startMinute || a.seg.column - b.seg.column),
      ),
    [columns, days, onEventClick],
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
      ref={regionRef}
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
            {row.segments.map((seg) => (
              <AllDayBar
                key={seg.placed.key}
                seg={seg}
                day={days[seg.column] as Date}
                locale={locale}
                labels={labels}
                onEventClick={onEventClick}
                className={classNames?.event}
              />
            ))}
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

        <div className="r-dates-timegrid-body">
          {HOURS.map((hour) => (
            <div key={hour} aria-hidden data-hour={hour} className="r-dates-timegrid-line" style={{ gridRow: hour + 1 }} />
          ))}
          {days.map((day, i) => {
            const nowMinute = minuteOfDay(now, day);
            const overlap = (columns[i] ?? []).reduce((max, seg) => Math.max(max, seg.columns), 1);
            return (
              <div
                key={toISODate(day)}
                data-day={toISODate(day)}
                className="r-dates-timegrid-day"
                style={{ gridColumn: i + 2, "--r-dates-overlap": overlap } as CSSProperties}
              >
                {(nav[i] ?? []).map((block) => (
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
                    onKeyDown={block.interactive ? (event) => onBlockKeyDown(event, block) : undefined}
                  />
                ))}
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

function AllDayBar({ seg, day, locale, labels, onEventClick, className }: SharedEventProps & { seg: LaneSegment; day: Date }) {
  const p = seg.placed;
  return (
    <EventTarget
      placed={p}
      name={eventName(p, locale, labels, day)}
      onEventClick={onEventClick}
      data-continues-before={seg.continuesBefore ? "" : undefined}
      data-continues-after={seg.continuesAfter ? "" : undefined}
      style={{ gridColumn: `${seg.column + 2} / span ${seg.span}`, gridRow: seg.lane + 1 }}
      className={cn(
        "r-dates-timegrid-bar flex items-center gap-r5 overflow-hidden border border-border bg-surface-1 pe-r5 text-fg-primary",
        isInteractiveEvent(p, onEventClick) && "hover:border-border-strong",
        className,
      )}
    >
      <EventMark slot={p.event.slot} className="r-dates-event-stripe" />
      <StatusGlyph placed={p} />
      <span dir="auto" className="min-w-0 truncate font-medium">{p.event.title}</span>
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
}: SharedEventProps & {
  block: Block;
  day: Date;
  tabIndex: number | undefined;
  blockRef: (el: HTMLElement | null) => void;
  onFocus?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
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
      tabIndex={tabIndex}
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
    </EventTarget>
  );
}
