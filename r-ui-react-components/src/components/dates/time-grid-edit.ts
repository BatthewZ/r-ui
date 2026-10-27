/**
 * Moving and resizing in the EventTimeGrid, as targets: where the keyboard's
 * arrows and a pointer pressed somewhere inside a block take an event. Built
 * on event-edit's helpers (stepping from a target is stepping from the event
 * placed there), so the grid only reads keys and geometry. Pure.
 */

import { addDays, startOfDay } from "./date-core";
import { daysBetween, inAllDayLane, type PlacedEvent } from "./event-core";
import {
  type CalendarRange,
  moveByDays,
  moveToSlot,
  rangeTouchesDay,
  resizeToDay,
  resizeToSlot,
  type SlotMinutes,
  type SlotPoint,
} from "./event-edit";

const DAY_MINUTES = 24 * 60;

const wallMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** `p` as it would be placed at `range`, by `placeEvents`'s rules: the edit helpers then step from a target. */
export function placedAt(p: PlacedEvent, range: CalendarRange): PlacedEvent {
  if (range.allDay) {
    const firstDay = startOfDay(range.start);
    const lastDay = startOfDay(range.end);
    return { ...p, allDay: true, start: firstDay.getTime(), end: addDays(lastDay, 1).getTime(), firstDay, lastDay };
  }
  const start = range.start.getTime();
  const end = Math.max(start, range.end.getTime());
  const firstDay = startOfDay(range.start);
  const lastDay = end > start ? startOfDay(new Date(end - 1)) : firstDay;
  return { ...p, allDay: false, start, end, firstDay, lastDay };
}

/** Whether `range` keeps `p` in the part of the grid it is in: a block never turns into an all-day bar, nor back. */
export const keepsKind = (p: PlacedEvent, range: CalendarRange) => inAllDayLane(placedAt(p, range)) === inAllDayLane(p);

/** Whether `range` shows on any of `days`. */
export const touchesDays = (range: CalendarRange, days: readonly Date[]) => days.some((day) => rangeTouchesDay(range, day));

/** The slot boundary after `minute` (`dir` 1) or before it (-1): one slot on from a boundary, the nearest one from between two. */
export function stepToSlot(minute: number, dir: 1 | -1, slot: SlotMinutes): number {
  return dir > 0 ? Math.floor(minute / slot) * slot + slot : Math.ceil(minute / slot) * slot - slot;
}

/** An arrow key, as the grab reads it. */
export interface GrabKey {
  key: string;
  shift: boolean;
  /** Left and Right are mirrored. */
  rtl: boolean;
}

/**
 * Where an arrow key takes a grabbed event from `target`, or `null` when it
 * does nothing. A block: Up/Down move its start a slot (to the boundary, from
 * between two), Left/Right a day keeping its time, Shift+Up/Down move its end
 * a slot (one slot long at least). The all-day row: Left/Right move by days,
 * and Shift+Left/Right move an all-day event's last day (never before its
 * first). An event never leaves its part of the grid, and a block's start
 * stays inside its day.
 */
export function keyedTarget(p: PlacedEvent, target: CalendarRange, k: GrabKey, slot: SlotMinutes): CalendarRange | null {
  const horizontal = k.key === "ArrowLeft" || k.key === "ArrowRight";
  if (!horizontal && k.key !== "ArrowUp" && k.key !== "ArrowDown") return null;
  const dir = (horizontal ? (k.key === "ArrowRight") !== k.rtl : k.key === "ArrowDown") ? 1 : -1;
  const q = placedAt(p, target);
  let next: CalendarRange | null = null;
  if (inAllDayLane(p)) {
    if (horizontal) next = !k.shift ? moveByDays(q, dir) : p.allDay ? resizeToDay(q, addDays(q.lastDay, dir)) : null;
  } else if (horizontal) {
    next = k.shift ? null : moveByDays(q, dir);
  } else if (!k.shift) {
    const minute = stepToSlot(wallMinutes(new Date(q.start)), dir, slot);
    next = minute < 0 || minute > DAY_MINUTES - slot ? null : moveToSlot(q, { day: q.firstDay, minute });
  } else {
    // The end in wall-clock minutes into the day it closes (1440 at the next midnight).
    const end = new Date(q.end);
    const endMinute = daysBetween(q.lastDay, end) * DAY_MINUTES + wallMinutes(end);
    next = resizeToSlot(q, { day: q.lastDay, minute: stepToSlot(endMinute, dir, slot) - slot }, slot);
  }
  return next && keepsKind(p, next) ? next : null;
}

/** Wall-clock minutes from `day`'s midnight to `ms`: negative on a day before, past 1440 on a day after. */
export function minutesFrom(day: Date, ms: number): number {
  const d = new Date(ms);
  return daysBetween(day, d) * DAY_MINUTES + wallMinutes(d);
}

/**
 * How far below a block's real start a press `pressMinute` minutes into
 * `day` (that block's column) is, snapped down to whole slots: kept through a
 * drag, so the block does not jump to put its start under the pointer. The
 * start may be on an earlier day (a block that continues from before).
 */
export function pressOffset(p: PlacedEvent, day: Date, pressMinute: number, slot: SlotMinutes): number {
  return Math.max(0, Math.floor((pressMinute - minutesFrom(day, p.start)) / slot) * slot);
}

/** The start for a block held `offset` minutes below its start, with the pointer over `under`: on an earlier day when it reaches past midnight. */
export function startUnder(under: SlotPoint, offset: number): SlotPoint {
  const minute = under.minute - offset;
  const days = Math.floor(minute / DAY_MINUTES);
  return { day: addDays(under.day, days), minute: minute - days * DAY_MINUTES };
}
