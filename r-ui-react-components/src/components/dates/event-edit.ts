/**
 * The EventCalendar's editing model: the ranges a user picks and the places an
 * event is moved or resized to, in `CalendarEvent`'s own terms, so an app can
 * write them straight back into its events. Pure, so every rule is tested
 * without a DOM.
 *
 * Slots are wall-clock minutes: a slot at 09:30 is 09:30 on that day whatever
 * the DST change around it, and a timed event moved by days keeps its time of
 * day. Lengths are kept in real time (milliseconds), so an hour-long meeting
 * stays an hour long across a change.
 */

import { addDays, dateFormatter, dayNumber, isSameDay, startOfDay } from "./date-core";
import { type CalendarEvent, daysBetween, type PlacedEvent } from "./event-core";
import { dayName, type EventCalendarLabels, formatTimeOfDay } from "./event-parts";

/** A span of time in `CalendarEvent`'s terms. */
export interface CalendarRange {
  /** All-day: the first day (local midnight). Timed: the start instant. */
  start: Date;
  /** All-day: the LAST day, inclusive (local midnight), as `CalendarEvent.end` reads it. Timed: the end instant, exclusive. */
  end: Date;
  allDay: boolean;
}

/** An event moved or resized: where it would go. The calendar never changes `events` itself. */
export interface CalendarEventChange extends CalendarRange {
  event: CalendarEvent;
  kind: "move" | "resize";
}

/** How finely the time grid picks and snaps, in minutes. */
export type SlotMinutes = 15 | 30 | 60;

export const SLOT_MINUTES: readonly SlotMinutes[] = [15, 30, 60];

const DAY_MINUTES = 24 * 60;

/** A slot: a day and the wall-clock minute it starts at. */
export interface SlotPoint {
  day: Date;
  minute: number;
}

/** `minute` wall-clock minutes into `day` (1440 is the next midnight). */
export function atMinute(day: Date, minute: number): Date {
  const d = startOfDay(day);
  d.setHours(0, minute, 0, 0);
  return d;
}

/** The start of the slot holding `minute`, inside the day. */
export function snapToSlot(minute: number, slot: SlotMinutes): number {
  const snapped = Math.floor(minute / slot) * slot;
  return Math.min(Math.max(snapped, 0), DAY_MINUTES - slot);
}

const slotOrder = (a: SlotPoint, b: SlotPoint) => dayNumber(a.day) - dayNumber(b.day) || a.minute - b.minute;

/** The timed range from one slot to another, either way round, both slots whole. */
export function slotRange(a: SlotPoint, b: SlotPoint, slot: SlotMinutes): CalendarRange {
  const [first, last] = slotOrder(a, b) <= 0 ? [a, b] : [b, a];
  return { start: atMinute(first.day, first.minute), end: atMinute(last.day, last.minute + slot), allDay: false };
}

/** The all-day range from one day to another, either way round, both days whole. */
export function dayRange(a: Date, b: Date): CalendarRange {
  const [first, last] = dayNumber(a) <= dayNumber(b) ? [a, b] : [b, a];
  return { start: startOfDay(first), end: startOfDay(last), allDay: true };
}

/** Where `p` is now, as a range. */
export function rangeOf(p: PlacedEvent): CalendarRange {
  return p.allDay
    ? { start: startOfDay(p.firstDay), end: startOfDay(p.lastDay), allDay: true }
    : { start: new Date(p.start), end: new Date(p.end), allDay: false };
}

/** A timed event moved to start at `to`, its length kept. */
export function moveToSlot(p: PlacedEvent, to: SlotPoint): CalendarRange {
  const start = atMinute(to.day, to.minute);
  return { start, end: new Date(start.getTime() + (p.end - p.start)), allDay: false };
}

/** `p` moved by whole days: an all-day event's days, a timed event's time of day kept. */
export function moveByDays(p: PlacedEvent, days: number): CalendarRange {
  if (p.allDay) return { start: addDays(p.firstDay, days), end: addDays(p.lastDay, days), allDay: true };
  const from = new Date(p.start);
  const start = atMinute(addDays(p.firstDay, days), from.getHours() * 60 + from.getMinutes());
  start.setSeconds(from.getSeconds(), from.getMilliseconds());
  return { start, end: new Date(start.getTime() + (p.end - p.start)), allDay: false };
}

/** `p` moved so its first day is `day`. */
export const moveToDay = (p: PlacedEvent, day: Date) => moveByDays(p, daysBetween(p.firstDay, day));

/** A timed event whose end is dragged into the slot `to`: it ends with that slot, at least one slot after its start. */
export function resizeToSlot(p: PlacedEvent, to: SlotPoint, slot: SlotMinutes): CalendarRange {
  const shortest = p.start + slot * 60_000;
  const end = Math.max(atMinute(to.day, to.minute + slot).getTime(), shortest);
  return { start: new Date(p.start), end: new Date(end), allDay: false };
}

/** An all-day event whose last day is dragged to `day`: never before its first. */
export function resizeToDay(p: PlacedEvent, day: Date): CalendarRange {
  const last = dayNumber(day) < dayNumber(p.firstDay) ? p.firstDay : day;
  return { start: startOfDay(p.firstDay), end: startOfDay(last), allDay: true };
}

export function sameRange(a: CalendarRange | null | undefined, b: CalendarRange | null | undefined): boolean {
  if (!a || !b) return a == b;
  return a.allDay === b.allDay && a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}

/** Whether `range` covers any part of `day`. */
export function rangeTouchesDay(range: CalendarRange, day: Date): boolean {
  const n = dayNumber(day);
  if (range.allDay) return n >= dayNumber(range.start) && n <= dayNumber(range.end);
  const lastDay = range.end.getTime() > range.start.getTime() ? new Date(range.end.getTime() - 1) : range.start;
  return n >= dayNumber(range.start) && n <= dayNumber(lastDay);
}

/**
 * A range said in full, for announcements and names: "Thursday, October 15",
 * "Oct 15 – 17" (days), "Thursday, October 15, 10:30 – 11:00 AM", or
 * "Oct 15, 11:00 PM – Oct 16, 1:00 AM" over midnight.
 */
export function describeRange(range: CalendarRange, locale: string, labels: Pick<EventCalendarLabels, "allDay">): string {
  if (range.allDay) {
    if (isSameDay(range.start, range.end)) return `${dayName(range.start, locale)}, ${labels.allDay}`;
    return dateFormatter(locale, { month: "short", day: "numeric" }).formatRange(range.start, range.end);
  }
  const lastInstant = new Date(Math.max(range.start.getTime(), range.end.getTime() - 1));
  if (isSameDay(range.start, lastInstant)) {
    const times = dateFormatter(locale, { hour: "numeric", minute: "2-digit" }).formatRange(range.start, range.end);
    return `${dayName(range.start, locale)}, ${times}`;
  }
  return dateFormatter(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatRange(
    range.start,
    range.end,
  );
}

/** A slot's own name: "Thursday, October 15, 10:30 AM". */
export function describeSlot(slot: SlotPoint, locale: string): string {
  return `${dayName(slot.day, locale)}, ${formatTimeOfDay(atMinute(slot.day, slot.minute).getTime(), locale)}`;
}

/** Whether `p` can be moved and resized: the calendar takes changes and the event does not opt out. */
export function isEditableEvent(p: PlacedEvent, onEventChange: unknown): boolean {
  return Boolean(onEventChange) && p.event.editable !== false;
}
