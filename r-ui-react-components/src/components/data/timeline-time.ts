import { dateTimeFormatter, type Locales, relativeTimeFormatter } from "../../util/format";

/*
 * Time for the Timeline (internal to the data group): parsing an event's time,
 * its day, and how it reads. Pure, so the arithmetic is tested without a DOM.
 *
 * An event time is an INSTANT (`Date`, epoch ms, or an ISO date-time string),
 * except a bare `YYYY-MM-DD` string, which is a CALENDAR DATE: it is read as
 * local midnight through `setFullYear` (`new Date("2026-10-15")` is UTC
 * midnight, the previous day west of Greenwich), keeps `datetime="YYYY-MM-DD"`
 * and reads as a day, never as "3 hours ago". Days are always local days, built
 * from local getters.
 */

export type TimelineTime = Date | string | number;

export interface ParsedTime {
  /** Epoch ms; NaN when the input is not a time. */
  ms: number;
  /** A calendar date (`YYYY-MM-DD` input): no time of day. */
  allDay: boolean;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseTime(time: TimelineTime): ParsedTime {
  if (typeof time === "string") {
    const m = DATE_ONLY.exec(time.trim());
    if (m) {
      const d = new Date(2000, 0, 1);
      d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      d.setHours(0, 0, 0, 0);
      return { ms: d.getTime(), allDay: true };
    }
    return { ms: time.trim() === "" ? Number.NaN : new Date(time).getTime(), allDay: false };
  }
  // Through `Date`, so a number past its range (±8.64e15) is NaN like any other non-time.
  return { ms: time instanceof Date ? time.getTime() : typeof time === "number" ? new Date(time).getTime() : Number.NaN, allDay: false };
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, "0");

/** The local day an instant falls on, as `YYYY-MM-DD` from local getters (also the day's `datetime`). */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  return `${y < 0 ? "-" : ""}${pad(y, 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The `datetime` attribute: the calendar date for a day, the UTC instant otherwise. */
export function datetimeAttr({ ms, allDay }: ParsedTime): string {
  return allDay ? dayKey(ms) : new Date(ms).toISOString();
}

/** Whole local days from `b` to `a` (DST-safe: counted on UTC dates built from local getters). */
export function dayDiff(a: number, b: number): number {
  const utc = (ms: number) => {
    const d = new Date(ms);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((utc(a) - utc(b)) / 86_400_000);
}

type Locale = Locales;

const dtf = dateTimeFormatter;
const rtf = (locale: Locale) => relativeTimeFormatter(locale, { numeric: "auto" });

/** First character upper-cased for the locale ("today" -> "Today"); leaves the rest alone. */
function capitalise(text: string, locale: Locale): string {
  const [first = "", ...rest] = Array.from(text);
  // The formatter's own resolved locale: always valid, where the caller's may not be.
  return first.toLocaleUpperCase(rtf(locale).resolvedOptions().locale) + rest.join("");
}

/** The full reading, for the hover title: weekday, date, time and zone (date only for a calendar date). */
export function formatFull(t: ParsedTime, locale?: Locale): string {
  return dtf(locale, t.allDay ? { dateStyle: "full" } : { dateStyle: "full", timeStyle: "long" }).format(t.ms);
}

/**
 * The visible absolute reading. Under a day header the day is already said, so
 * only the time of day; on its own, date and time.
 */
export function formatAbsolute(t: ParsedTime, { grouped, locale }: { grouped: boolean; locale?: Locale }): string {
  if (t.allDay) return dtf(locale, { dateStyle: "medium" }).format(t.ms);
  return dtf(locale, grouped ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }).format(t.ms);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "now", "5 minutes ago", "in 3 hours", "yesterday", "2 weeks ago": the largest
 * unit that keeps the number whole, the locale's words (`numeric: "auto"`). A
 * calendar date counts calendar days.
 */
export function formatRelative(t: ParsedTime, now: number, locale?: Locale): string {
  const f = rtf(locale);
  const days = dayDiff(t.ms, now);
  const delta = t.ms - now;
  const abs = Math.abs(delta);
  if (!t.allDay) {
    if (abs < 45_000) return f.format(0, "second");
    if (abs < 45 * MINUTE) return f.format(Math.round(delta / MINUTE), "minute");
    if (abs < 22 * HOUR) return f.format(Math.round(delta / HOUR), "hour");
  }
  const absDays = Math.abs(days);
  if (absDays < 7) return f.format(days, "day");
  if (absDays < 30) return f.format(Math.round(days / 7), "week");
  if (abs < 365 * DAY) return f.format(Math.round(delta / (30.44 * DAY)), "month");
  return f.format(Math.round(delta / (365.25 * DAY)), "year");
}

/** A day header: "Today", "Yesterday", "Tomorrow", else "Wed, 14 Oct" (with the year when it is not this year's). */
export function formatDay(ms: number, now: number, locale?: Locale): string {
  const days = dayDiff(ms, now);
  if (Math.abs(days) <= 1) return capitalise(rtf(locale).format(days, "day"), locale);
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return dtf(locale, { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(ms);
}
