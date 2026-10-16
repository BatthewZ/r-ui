/**
 * Time-of-day arithmetic, formatting and layout for the dates group, on `Date`
 * and `Intl` only.
 *
 * Time stance (the counterpart of date-core's calendar dates):
 *
 * - A TIME OF DAY is wall-clock, 24-hour `HH:mm` (or `HH:mm:ss`): no date, no
 *   zone, no offset. 09:00 is "nine on the clock" wherever and whenever it is
 *   read, the way `<input type="time">` submits it. `TimeField` and `TimePicker`
 *   values and their wire format are that string.
 * - A DATE-TIME (a `DateRangePicker withTime` endpoint) is a `Date` at a LOCAL
 *   wall-clock time: the calendar day read through the local getters, with
 *   `setHours` applied. It is therefore also a real instant in the user's zone,
 *   so durations computed from it are true elapsed time. There is no `timeZone`
 *   prop: a range in another zone is the caller's conversion at the edges.
 * - DST: a wall-clock time inside a spring-forward gap (02:30 on the night the
 *   clocks skip 02:00–03:00) does not exist; `Date` moves it forward by the
 *   gap (03:30), and that resolved time is what the value holds and the fields
 *   show on reopening. A time inside a fall-back overlap (01:30 twice) resolves
 *   to the EARLIER instant (still on summer time). The wire format of a
 *   date-time (`toISODateTime`) carries the UTC offset, so the overlap's two
 *   01:30s stay distinct on the wire while the wall clock stays readable.
 */

import { asciiDigits, dateFormatter } from "./date-core";

/** The clock a field shows: `h23` 0–23, `h12` 1–12 with AM/PM, `h11` 0–11 with AM/PM. */
export type HourCycle = "h11" | "h12" | "h23";

export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

const DAY_SECONDS = 86_400;
const TIME = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/;

/** The time a wire string names (`H:mm`, `HH:mm`, `HH:mm:ss`, 24-hour), or `null`. */
export function parseTimeValue(text: string | null | undefined): TimeParts | null {
  const m = text == null ? null : TIME.exec(text);
  if (!m) return null;
  const t = { hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3] ?? 0) };
  return t.hour <= 23 && t.minute <= 59 && t.second <= 59 ? t : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The wire string: `HH:mm`, or `HH:mm:ss` with `withSeconds`. */
export function formatTimeValue(t: TimeParts, withSeconds = false): string {
  return `${pad(t.hour)}:${pad(t.minute)}${withSeconds ? `:${pad(t.second)}` : ""}`;
}

export function timeToSeconds(t: TimeParts): number {
  return t.hour * 3600 + t.minute * 60 + t.second;
}

function secondsToTime(n: number): TimeParts {
  const s = ((n % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  return { hour: Math.floor(s / 3600), minute: Math.floor((s % 3600) / 60), second: s % 60 };
}

/**
 * Whether `t` lies in `[min, max]` (either bound optional, both inclusive).
 * A `min` after `max` is a window across midnight (22:00–06:00).
 */
export function isTimeAllowed(t: TimeParts, min?: TimeParts | null, max?: TimeParts | null): boolean {
  const n = timeToSeconds(t);
  const lo = min ? timeToSeconds(min) : 0;
  const hi = max ? timeToSeconds(max) : DAY_SECONDS - 1;
  return lo <= hi ? n >= lo && n <= hi : n >= lo || n <= hi;
}

/**
 * The times from `min` to `max` (default the whole day) every `stepMinutes`,
 * across midnight when `min` is after `max`: a picker's list.
 */
export function timeSlots(stepMinutes: number, min?: TimeParts | null, max?: TimeParts | null): TimeParts[] {
  const step = Math.max(1, Math.round(stepMinutes)) * 60;
  const lo = min ? timeToSeconds(min) : 0;
  const hi = max ? timeToSeconds(max) : DAY_SECONDS - 1;
  const span = (hi - lo + DAY_SECONDS) % DAY_SECONDS;
  return Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => secondsToTime(lo + i * step));
}

/** The locale's clock, unless the caller asks for 12 or 24 hours. */
export function hourCycleFor(locale: string, prefer?: 12 | 24): HourCycle {
  if (prefer === 24) return "h23";
  const resolved = dateFormatter(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
  if (prefer === 12) return resolved === "h11" ? "h11" : "h12";
  return resolved === "h11" || resolved === "h12" ? resolved : "h23";
}

export const isTwelveHour = (cycle: HourCycle) => cycle !== "h23";

export type TimeSegmentType = "hour" | "minute" | "second" | "dayPeriod";

export type TimeLayoutPart = { type: TimeSegmentType } | { type: "literal"; value: string };

export interface TimeLayout {
  /** Segments and the literals between them, in the locale's order ("오전 9:30", "9:30 AM", "9.30"). */
  parts: TimeLayoutPart[];
  /** The locale's two day-period words. */
  am: string;
  pm: string;
}

function formatOptions(cycle: HourCycle, withSeconds: boolean): Intl.DateTimeFormatOptions {
  return { hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}), hourCycle: cycle };
}

/** A local date on a day with no DST transition, at `t`: only ever formatted. */
const sample = (t: TimeParts) => new Date(2026, 0, 1, t.hour, t.minute, t.second);

export function timeLayout(locale: string, cycle: HourCycle, withSeconds: boolean): TimeLayout {
  const format = dateFormatter(locale, formatOptions(cycle, withSeconds));
  const period = (hour: number) =>
    dateFormatter(locale, { hour: "numeric", hourCycle: "h12" })
      .formatToParts(sample({ hour, minute: 0, second: 0 }))
      .find((p) => p.type === "dayPeriod")?.value ?? (hour < 12 ? "AM" : "PM");
  const parts: TimeLayoutPart[] = [];
  for (const p of format.formatToParts(sample({ hour: 21, minute: 5, second: 7 }))) {
    if (p.type === "hour" || p.type === "minute" || p.type === "second" || p.type === "dayPeriod") parts.push({ type: p.type });
    else if (p.type === "literal") parts.push({ type: "literal", value: p.value.replace(/[‎‏]/g, "") });
  }
  return { parts, am: period(9), pm: period(21) };
}

/**
 * Each segment's text in the locale's digits, two wide ("09", "٠٩"), for `t`
 * (24-hour). The hour is the cycle's (21 is "09" on a 12-hour clock).
 */
export function segmentTexts(t: TimeParts, locale: string, cycle: HourCycle): Record<"hour" | "minute" | "second", string> {
  const out = { hour: pad(t.hour), minute: pad(t.minute), second: pad(t.second) };
  for (const p of dateFormatter(locale, formatOptions(cycle, true)).formatToParts(sample(t))) {
    if (p.type === "hour" || p.type === "minute" || p.type === "second") out[p.type] = p.value;
  }
  return out;
}

/** The hour as the cycle's clock shows it (21 is 9 on a 12-hour clock). */
export function clockHour(hour: number, cycle: HourCycle): number {
  if (cycle === "h23") return hour;
  return cycle === "h12" ? hour % 12 || 12 : hour % 12;
}

/** "9:30 AM" / "09:30": a time as the locale reads it, for a list or a message. */
export function formatTimeLabel(t: TimeParts, locale: string, cycle: HourCycle, withSeconds = false): string {
  return dateFormatter(locale, {
    // A 24-hour clock keeps the hour two wide ("09:30"), as its field shows it.
    hour: isTwelveHour(cycle) ? "numeric" : "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hourCycle: cycle,
  }).format(sample(t));
}

/** A typed digit in any script as 0–9, else `null`. */
export function digitOf(key: string): number | null {
  if ([...key].length !== 1) return null;
  const ascii = asciiDigits(key);
  return /^[0-9]$/.test(ascii) ? Number(ascii) : null;
}

/**
 * `day`'s calendar date at the local wall-clock time `t`. A time in a DST gap
 * moves forward by the gap; one in an overlap is the earlier instant (see the
 * stance above).
 */
export function withTimeOfDay(day: Date, t: TimeParts): Date {
  const out = new Date(day.getTime());
  out.setHours(t.hour, t.minute, t.second, 0);
  return out;
}

/** The local wall-clock time of `d`. */
export function timeOf(d: Date): TimeParts {
  return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
}

/**
 * `2026-10-15T09:30+02:00`: the local calendar date and wall-clock time of `d`
 * with its UTC offset (ISO 8601). Built from the local getters, never
 * `toISOString()`, so the wall clock reads as the user chose it; the offset
 * makes it one instant even inside a DST overlap.
 */
export function toISODateTime(d: Date, { seconds = false }: { seconds?: boolean } = {}): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const offset = -Math.round(d.getTimezoneOffset());
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return (
    `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${formatTimeValue(timeOf(d), seconds)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
