"use client";
import { useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { CalendarBase, type CalendarCommonProps } from "./calendar-base";
import { addDays, type DateRange, dayNumber, isSameDay, isSameRange } from "./date-core";

export interface RangeCalendarProps extends CalendarCommonProps {
  value?: DateRange;
  defaultValue?: DateRange;
  /** Called on each press: `{ start, end: null }` after the first, the ordered range after the second. */
  onValueChange?: (range: DateRange) => void;
}

const EMPTY: DateRange = { start: null, end: null };

/**
 * A month grid for choosing a range of days: the first press (or Enter) sets the
 * start, the second the end, in either order. While the end is open, the band
 * previews the range under the pointer or the keyboard focus.
 *
 * The band is a shape, not only a tint: filled endpoints joined by a band that
 * starts and stops halfway through their cells; each day's name says "start of
 * range", "in range" or "end of range". A day is refused as the second endpoint
 * when an unavailable day lies between it and the start, so a range never spans
 * a day the caller ruled out. `months` defaults to 2.
 */
export function RangeCalendar({ value, defaultValue = EMPTY, onValueChange, months = 2, isDateUnavailable, ...props }: RangeCalendarProps) {
  const [range, setRange] = useControllableState<DateRange>({ value, defaultValue, isEqual: isSameRange });
  const [hover, setHover] = useState<Date | null>(null);
  const { start, end } = range;
  const picking = start != null && end == null;

  // The span the band covers: the committed range, or the start and the day under focus.
  const other = picking ? hover : end;
  const [lo, hi] =
    start && other ? (dayNumber(start) <= dayNumber(other) ? [start, other] : [other, start]) : [start, start];

  const isBlocked = (day: Date) => {
    if (!picking || !start || !isDateUnavailable) return false;
    const [from, to] = dayNumber(day) < dayNumber(start) ? [day, start] : [start, day];
    for (let d = addDays(from, 1); dayNumber(d) < dayNumber(to); d = addDays(d, 1)) {
      if (isDateUnavailable(d)) return true;
    }
    return false;
  };

  const commit = (next: DateRange) => {
    setRange(next);
    onValueChange?.(next);
  };

  return (
    <CalendarBase
      {...props}
      months={months}
      isDateUnavailable={isDateUnavailable}
      isBlocked={isBlocked}
      anchor={start ?? end}
      dayState={(day) => {
        // One point (only a start, or a one-day range) is a plain selection: no band.
        if (!lo || !hi || isSameDay(lo, hi)) return { selected: isSameDay(day, start) };
        const n = dayNumber(day);
        return {
          rangeStart: isSameDay(day, lo),
          rangeEnd: isSameDay(day, hi),
          inRange: n > dayNumber(lo) && n < dayNumber(hi),
        };
      }}
      onActiveChange={picking ? setHover : undefined}
      onPick={(day) => {
        if (!picking) {
          commit({ start: day, end: null });
          setHover(day);
        } else if (start && dayNumber(day) < dayNumber(start)) {
          commit({ start: day, end: start });
        } else {
          commit({ start, end: day });
        }
      }}
    />
  );
}
