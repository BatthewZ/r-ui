/**
 * Where a pointer is in the EventTimeGrid, from the grid as laid out: the day
 * columns (`.r-dates-timegrid-day[data-day]`, which differ in width when one
 * day holds more overlapping events) and the hour lines (`[data-hour]`, which
 * set the vertical scale whatever density, input or theme made it). The one
 * source for picking a range and for moving or resizing an event by pointer.
 */

import { parseISODate } from "./date-core";
import { type SlotMinutes, type SlotPoint, snapToSlot } from "./event-edit";

/** The day columns of `body`, in DOM order (the reading order of the days). */
export function dayColumns(body: ParentNode): HTMLElement[] {
  return [...body.querySelectorAll<HTMLElement>(".r-dates-timegrid-day[data-day]")];
}

/** The day whose column holds `x`; past the first or last column, the nearest one. `null` with no columns. */
export function dayAtX(body: ParentNode, x: number): Date | null {
  let best: { el: HTMLElement; distance: number } | null = null;
  for (const el of dayColumns(body)) {
    const r = el.getBoundingClientRect();
    const distance = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (!best || distance < best.distance) best = { el, distance };
    if (distance === 0) break;
  }
  return best ? parseISODate(best.el.dataset.day ?? "") : null;
}

/** Wall-clock minutes at client `y`, from the hour lines; `null` when they are not laid out. */
export function minuteAtY(body: ParentNode, y: number): number | null {
  const zero = body.querySelector<HTMLElement>('[data-hour="0"]')?.getBoundingClientRect();
  const one = body.querySelector<HTMLElement>('[data-hour="1"]')?.getBoundingClientRect();
  if (!zero || !one) return null;
  const hour = one.top - zero.top;
  if (!(hour > 0)) return null;
  return ((y - zero.top) / hour) * 60;
}

/** The slot under client (`x`, `y`): its day and its snapped start minute, kept inside the day. */
export function slotAt(body: ParentNode, x: number, y: number, slot: SlotMinutes): SlotPoint | null {
  const day = dayAtX(body, x);
  const minute = minuteAtY(body, y);
  if (!day || minute === null) return null;
  return { day, minute: snapToSlot(minute, slot) };
}
