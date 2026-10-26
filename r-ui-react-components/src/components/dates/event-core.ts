/**
 * The EventCalendar's model: where caller events fall in local time, which
 * period a view shows, and how events are packed into month lanes and
 * time-grid columns. Pure, so every rule is tested without a DOM.
 *
 * An event time is an INSTANT (`Date`, epoch ms, ISO date-time string), except
 * a bare `YYYY-MM-DD`, which is a CALENDAR DATE (an all-day event), read as
 * local midnight through the dates group's `parseISODate`. Days are local days
 * from local getters; minutes in a day are wall-clock minutes, so a DST day
 * still draws 09:00 at the 09:00 line.
 */

import type { StatusTone } from "../../util/tone";
import type { SeriesSlot } from "../data";
import { addDays, addMonths, dayNumber, parseISODate, startOfDay, startOfMonth, type Weekday } from "./date-core";

/** An instant (`Date`, epoch ms, ISO date-time string) or a `YYYY-MM-DD` calendar date. */
export type EventTime = Date | string | number;

export interface CalendarEvent {
  /** Stable key, unique among the events (a repeat is shown, keyed apart). */
  id: string;
  title: string;
  /**
   * An instant, or `YYYY-MM-DD` for an all-day event. An event whose start is
   * not a time is left out.
   */
  start: EventTime;
  /**
   * An instant: the event ends there (exclusive), so 09:00–10:00 ends at 10:00
   * and one ending at midnight does not reach the next day. An all-day event:
   * its LAST day, inclusive (`YYYY-MM-DD`). Omitted, or before `start`: an
   * instant event is a moment, an all-day event one day.
   */
  end?: EventTime;
  /** All-day even when `start` is an instant (its local day). */
  allDay?: boolean;
  /**
   * The colour of the entity it belongs to (a calendar, a team, a service):
   * a series slot, drawn as a mark beside the title, never under text. Name the
   * entity in `category`, as colour never says it alone.
   */
  slot?: SeriesSlot;
  /** What `slot` stands for ("Platform team"), said with the event. */
  category?: string;
  /** A status the event is in: drawn with its glyph, and its word in the event's name. */
  tone?: StatusTone;
  /** The status word; defaults to the tone's word in `labels.tones`. */
  statusLabel?: string;
  location?: string;
  /** Longer text: shown in the agenda, and in the event's tooltip elsewhere. */
  description?: string;
  /** The event is a link (through the `RouterProvider` for an internal path). */
  href?: string;
}

export type EventCalendarView = "month" | "week" | "day" | "agenda";

export const EVENT_CALENDAR_VIEWS: readonly EventCalendarView[] = ["month", "week", "day", "agenda"];

/** At most this many events are read; the rest are not placed (bounded work). */
export const MAX_EVENTS = 10_000;

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

/** An event placed in local time. */
export interface PlacedEvent {
  event: CalendarEvent;
  /** Unique among the placed events: the id, with `~n` added to a repeat. */
  key: string;
  /** Epoch ms. All-day: local midnight of its first day. */
  start: number;
  /** Epoch ms, exclusive, never before `start`. All-day: local midnight after its last day. */
  end: number;
  allDay: boolean;
  /** The first and last local days it occupies (local midnight), the last inclusive. */
  firstDay: Date;
  lastDay: Date;
}

const DATE_ONLY = /^\s*\d{4}-\d{1,2}-\d{1,2}\s*$/;

interface ParsedTime {
  ms: number;
  /** It was a `YYYY-MM-DD` calendar date. */
  date: boolean;
}

function parseEventTime(time: EventTime | undefined): ParsedTime | null {
  if (time === undefined || time === null) return null;
  if (typeof time === "string") {
    if (DATE_ONLY.test(time)) {
      const d = parseISODate(time);
      return d ? { ms: d.getTime(), date: true } : null;
    }
    if (time.trim() === "") return null;
    const ms = new Date(time).getTime();
    return Number.isFinite(ms) ? { ms, date: false } : null;
  }
  // Through `Date`, so a number past its range (±8.64e15) is not a time either.
  const ms = time instanceof Date ? time.getTime() : typeof time === "number" ? new Date(time).getTime() : Number.NaN;
  return Number.isFinite(ms) ? { ms, date: false } : null;
}

/** The local midnight starting `ms`'s calendar day. */
const dayOf = (ms: number) => startOfDay(new Date(ms));

/**
 * The events that can be placed, in local time, sorted by start (then the
 * longer first, then input order). An event whose start is not a time is left
 * out; one whose end is missing, not a time or before its start is a moment
 * (or one day, all-day). Repeated ids are keyed apart.
 */
export function placeEvents(events: readonly CalendarEvent[]): PlacedEvent[] {
  const seen = new Map<string, number>();
  const placed: { p: PlacedEvent; index: number }[] = [];
  events.slice(0, MAX_EVENTS).forEach((event, index) => {
    if (event == null) return;
    const start = parseEventTime(event.start);
    if (!start) return;
    const end = parseEventTime(event.end);
    const allDay = start.date || event.allDay === true;
    const id = String(event.id);
    const repeat = seen.get(id) ?? 0;
    seen.set(id, repeat + 1);
    const key = repeat === 0 ? id : `${id}~${repeat}`;

    if (allDay) {
      const firstDay = dayOf(start.ms);
      // An all-day end names its last day: a date as is, an instant by the day it falls on.
      const last = end ? dayOf(end.ms) : firstDay;
      const lastDay = dayNumber(last) >= dayNumber(firstDay) ? last : firstDay;
      placed.push({
        index,
        p: { event, key, start: firstDay.getTime(), end: addDays(lastDay, 1).getTime(), allDay: true, firstDay, lastDay },
      });
      return;
    }

    // A calendar-date end on a timed event ends with that day (it is inclusive).
    const endMs = end ? (end.date ? addDays(new Date(end.ms), 1).getTime() : end.ms) : start.ms;
    const finish = endMs >= start.ms ? endMs : start.ms;
    const firstDay = dayOf(start.ms);
    // Exclusive end: an event ending at midnight does not occupy the next day.
    const lastDay = finish > start.ms ? dayOf(finish - 1) : firstDay;
    placed.push({ index, p: { event, key, start: start.ms, end: finish, allDay: false, firstDay, lastDay } });
  });
  placed.sort((a, b) => a.p.start - b.p.start || b.p.end - a.p.end || a.index - b.index);
  return placed.map(({ p }) => p);
}

/** Whether `p` occupies any day in `[from, to)` (local days). */
export function touchesDays(p: PlacedEvent, from: Date, to: Date): boolean {
  return dayNumber(p.lastDay) >= dayNumber(from) && dayNumber(p.firstDay) < dayNumber(to);
}

/** Whether `p` occupies `day`. */
export const occursOn = (p: PlacedEvent, day: Date) => touchesDays(p, day, addDays(day, 1));

/** Whole local days from `a` to `b` (DST-safe: counted on UTC dates built from local getters). */
export function daysBetween(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** The time grid's all-day lane holds all-day events and timed ones a day or longer. */
export function inAllDayLane(p: PlacedEvent): boolean {
  return p.allDay || p.end - p.start >= DAY_MINUTES * MINUTE;
}

// ── Periods ────────────────────────────────────────────────────────────────

/** The days a view shows: `[start, end)`, local midnights. */
export interface Period {
  start: Date;
  end: Date;
}

export function startOfWeek(d: Date, weekStart: Weekday): Date {
  return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}

/** The period `view` shows around `date`: its month (month, agenda), its week, or the day. */
export function periodOf(view: EventCalendarView, date: Date, weekStart: Weekday): Period {
  if (view === "week") {
    const start = startOfWeek(date, weekStart);
    return { start, end: addDays(start, 7) };
  }
  if (view === "day") {
    const start = startOfDay(date);
    return { start, end: addDays(start, 1) };
  }
  const start = startOfMonth(date);
  return { start, end: addMonths(start, 1) };
}

/** `date` moved by `delta` of the view's periods (a month keeps its day, clamped: 31 Jan + 1 is 28/29 Feb). */
export function stepDate(view: EventCalendarView, date: Date, delta: number): Date {
  if (view === "week") return addDays(date, 7 * delta);
  if (view === "day") return addDays(date, delta);
  return addMonths(date, delta);
}

/**
 * The weeks a month view draws: every week that holds a day of `month`, whole
 * (the neighbouring months' days included), so four to six rows.
 */
export function monthWeeks(month: Date, weekStart: Weekday): Date[][] {
  const first = startOfMonth(month);
  const next = addMonths(first, 1);
  const weeks: Date[][] = [];
  for (let start = startOfWeek(first, weekStart); dayNumber(start) < dayNumber(next); start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

// ── Lanes: a row of days (a month week, the time grid's all-day lane) ───────

export interface LaneSegment {
  placed: PlacedEvent;
  /** The column of its first day in this row (0-based) and how many columns it covers. */
  column: number;
  span: number;
  lane: number;
  /** It began before this row, or goes on after it. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface RowLayout {
  /** The segments drawn, each in a lane below `maxLanes`. */
  segments: LaneSegment[];
  /** Per column: every event on that day, drawn or not, in day order. */
  events: PlacedEvent[][];
  /** Per column: how many of that day's events are not drawn ("+n more", in the last lane). */
  hidden: number[];
}

/** Day order inside one day: all-day and multi-day first, then by start, the longer first. */
export function dayOrder(a: PlacedEvent, b: PlacedEvent): number {
  return Number(inAllDayLane(b)) - Number(inAllDayLane(a)) || a.start - b.start || b.end - a.end;
}

/**
 * Packs the events touching `days` columns from `rowStart` into lanes: each
 * takes the lowest lane free across all its days (longest first among those
 * that start together). A day with more events than `maxLanes` gives its last
 * lane to "+n more", so a segment is drawn only where every day it covers has
 * room for its lane; a hidden segment counts as hidden on each of its days.
 */
export function layoutRow(
  placed: readonly PlacedEvent[],
  rowStart: Date,
  days: number,
  maxLanes: number,
  include: (p: PlacedEvent) => boolean = () => true,
): RowLayout {
  const rowEnd = addDays(rowStart, days);
  const inRow = placed.filter((p) => include(p) && touchesDays(p, rowStart, rowEnd));
  const all: LaneSegment[] = inRow
    .map((p) => {
      const from = Math.max(0, daysBetween(rowStart, p.firstDay));
      const to = Math.min(days - 1, daysBetween(rowStart, p.lastDay));
      return {
        placed: p,
        column: from,
        span: to - from + 1,
        lane: 0,
        continuesBefore: dayNumber(p.firstDay) < dayNumber(rowStart),
        continuesAfter: dayNumber(p.lastDay) >= dayNumber(rowEnd),
      };
    })
    .sort((a, b) => a.column - b.column || b.span - a.span || dayOrder(a.placed, b.placed));

  const taken: boolean[][] = Array.from({ length: days }, () => []);
  for (const seg of all) {
    let lane = 0;
    while (Array.from({ length: seg.span }, (_, i) => taken[seg.column + i]?.[lane]).some(Boolean)) lane += 1;
    seg.lane = lane;
    for (let i = 0; i < seg.span; i += 1) (taken[seg.column + i] as boolean[])[lane] = true;
  }

  const lanes = Math.max(0, Math.floor(maxLanes));
  const covers = (seg: LaneSegment, col: number) => col >= seg.column && col < seg.column + seg.span;
  const events = Array.from({ length: days }, (_, col) =>
    all.filter((seg) => covers(seg, col)).map((seg) => seg.placed).sort(dayOrder),
  );
  // A crowded day keeps its last lane for "+n more". One pass is enough: every
  // lane below a segment's own is taken on its first day, so no day is left
  // with a hidden event AND a drawn one in its last lane (a randomised test
  // holds this).
  const limit = events.map((list) => (list.length > lanes ? lanes - 1 : lanes));
  const drawn = all.filter((seg) =>
    Array.from({ length: seg.span }, (_, i) => limit[seg.column + i] ?? 0).every((l) => seg.lane < l),
  );
  const hidden = events.map((list, col) => list.length - drawn.filter((seg) => covers(seg, col)).length);
  return { segments: drawn, events, hidden };
}

// ── The time grid: one day's timed events ──────────────────────────────────

/** A block shorter than this many minutes is drawn this tall (one `--ROW-H` at two rows an hour). */
export const MIN_BLOCK_MINUTES = 30;

export interface DaySegment {
  placed: PlacedEvent;
  /** Wall-clock minutes from the day's start, clipped to the day: `0 ≤ start ≤ end ≤ 1440`. */
  startMinute: number;
  endMinute: number;
  /** It began on an earlier day, or goes on into the next. */
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** Overlapping events share the width: this one is in `column` of `columns` equal tracks… */
  column: number;
  columns: number;
  /** …and widens over this many tracks (≥ 1) where the tracks after it are free. */
  span: number;
}

const wallMinutes = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

/** The minute a block is drawn down to: its end, or `MIN_BLOCK_MINUTES` below its start, within the day. */
export const drawnEnd = (seg: Pick<DaySegment, "startMinute" | "endMinute">) =>
  Math.min(DAY_MINUTES, Math.max(seg.endMinute, seg.startMinute + MIN_BLOCK_MINUTES));

/**
 * The timed events on `day` (not those in the all-day lane), clipped to it and
 * laid side by side where they overlap: each cluster of transitively
 * overlapping blocks shares its width in equal tracks, every block in the
 * first track free at its start, widened over free tracks after it.
 */
export function layoutDay(placed: readonly PlacedEvent[], day: Date): DaySegment[] {
  const dayStart = startOfDay(day);
  const next = addDays(dayStart, 1);
  const segs: DaySegment[] = placed
    .filter((p) => !inAllDayLane(p) && occursOn(p, dayStart))
    .map((p) => {
      const continuesBefore = p.start < dayStart.getTime();
      const continuesAfter = dayNumber(p.lastDay) > dayNumber(dayStart);
      const startMinute = continuesBefore ? 0 : wallMinutes(p.start);
      const endMinute = continuesAfter || p.end >= next.getTime() ? DAY_MINUTES : Math.max(startMinute, wallMinutes(p.end));
      return { placed: p, startMinute, endMinute, continuesBefore, continuesAfter, column: 0, columns: 1, span: 1 };
    })
    .sort((a, b) => a.startMinute - b.startMinute || drawnEnd(b) - drawnEnd(a));

  let cluster: DaySegment[] = [];
  let clusterEnd = -1;
  const columnEnds: number[] = [];
  const close = () => {
    const columns = Math.max(1, columnEnds.length);
    for (const seg of cluster) {
      seg.columns = columns;
      let span = 1;
      while (
        seg.column + span < columns &&
        !cluster.some((o) => o.column === seg.column + span && o.startMinute < drawnEnd(seg) && seg.startMinute < drawnEnd(o))
      ) {
        span += 1;
      }
      seg.span = span;
    }
    cluster = [];
    clusterEnd = -1;
    columnEnds.length = 0;
  };
  for (const seg of segs) {
    if (cluster.length > 0 && seg.startMinute >= clusterEnd) close();
    let column = columnEnds.findIndex((end) => end <= seg.startMinute);
    if (column === -1) column = columnEnds.push(0) - 1;
    columnEnds[column] = drawnEnd(seg);
    seg.column = column;
    cluster.push(seg);
    clusterEnd = Math.max(clusterEnd, drawnEnd(seg));
  }
  if (cluster.length > 0) close();
  return segs;
}

/** Wall-clock minutes into `day` of the instant `now`, or `null` when `now` is another day. */
export function minuteOfDay(now: number, day: Date): number | null {
  return dayNumber(new Date(now)) === dayNumber(day) ? wallMinutes(now) : null;
}
