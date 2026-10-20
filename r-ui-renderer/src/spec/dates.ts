/**
 * ISO text to `Date`, strictly: the one parser the renderer, the forms and the
 * validator share. A bare `YYYY-MM-DD` is that calendar date at local midnight
 * (never UTC midnight, which is the previous day west of Greenwich); a
 * date-time with `Z` or an offset is that instant, without one it is local
 * time. Impossible dates and times are refused, never rolled over.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/i;

/** Text that starts like an ISO date: refused rather than ignored when it does not parse. */
export const ISO_SHAPED = /^\d{4}-\d{2}-\d{2}/;

function daysIn(year: number, month: number): number {
  // Day 0 of the next month is the last of this one; 2000 is a leap year, 2001 is not.
  return new Date(Date.UTC(isLeap(year) ? 2000 : 2001, month, 0)).getUTCDate();
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function validDay(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}

function localDate(year: number, month: number, day: number, h = 0, m = 0, s = 0, ms = 0): Date {
  const date = new Date(2000, 0, 1, h, m, s, ms);
  // setFullYear, because the constructor reads years 0–99 as 1900–1999.
  date.setFullYear(year, month - 1, day);
  return date;
}

/** The local calendar date `text` (`YYYY-MM-DD`) names, or null. */
export function parseIsoDate(text: string): Date | null {
  const match = DATE.exec(text);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return validDay(year, month, day) ? localDate(year, month, day) : null;
}

/** The instant (or local time) `text` names, a bare date included, or null. */
export function parseIsoDateTime(text: string): Date | null {
  const bare = parseIsoDate(text);
  if (bare !== null) return bare;
  const match = DATE_TIME.exec(text);
  if (match === null) return null;
  const [year, month, day, hour, minute] = [1, 2, 3, 4, 5].map((index) => Number(match[index])) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const ms = match[7] === undefined ? 0 : Math.floor(Number(`0.${match[7]}`) * 1000);
  if (!validDay(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const zone = match[8];
  if (zone === undefined) return localDate(year, month, day, hour, minute, second, ms);
  let offset = 0;
  if (zone.toUpperCase() !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const zoneHours = Number(zone.slice(1, 3));
    const zoneMinutes = Number(zone.slice(4, 6));
    if (zoneHours > 23 || zoneMinutes > 59) return null;
    offset = sign * (zoneHours * 60 + zoneMinutes);
  }
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(hour, minute, second, ms);
  return new Date(utc.getTime() - offset * 60_000);
}

/** A bare date at UTC midnight, for formatting in UTC; other text as `parseIsoDateTime`. */
export function parseIsoDateTimeUtc(text: string): Date | null {
  const match = DATE.exec(text);
  if (match === null) return parseIsoDateTime(text);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!validDay(year, month, day)) return null;
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  return utc;
}

/** A bare `YYYY-MM-DD` naming a real calendar date. */
export function isIsoDate(text: string): boolean {
  return parseIsoDate(text) !== null;
}

/** A real date, or a real date and time with an optional `Z` or `±hh:mm` offset. */
export function isIsoDateTime(text: string): boolean {
  return parseIsoDateTime(text) !== null;
}
