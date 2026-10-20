/**
 * Value checks the renderer makes before a value reaches a component, made
 * here without React: ISO dates (strict, never rolled over) and the codes
 * `Intl` throws on.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))?$/i;

/** Text that starts like an ISO date; the renderer refuses it rather than passing it on when it does not parse. */
export const ISO_SHAPED = /^\d{4}-\d{2}-\d{2}/;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const days = month === 2 && isLeap(year) ? 29 : (DAYS[month - 1] as number);
  return day <= days;
}

/** A bare `YYYY-MM-DD` naming a real calendar date. */
export function isIsoDate(text: string): boolean {
  const match = DATE.exec(text);
  return match !== null && validDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** A real date, or a real date and time with an optional `Z` or `±hh:mm` offset. */
export function isIsoDateTime(text: string): boolean {
  if (isIsoDate(text)) return true;
  const match = DATE_TIME.exec(text);
  if (match === null) return false;
  const [hour, minute, second] = [Number(match[4]), Number(match[5]), match[6] === undefined ? 0 : Number(match[6])];
  if (!validDay(Number(match[1]), Number(match[2]), Number(match[3])) || hour > 23 || minute > 59 || second > 59) return false;
  return match[8] === undefined || (Number(match[8]) <= 23 && Number(match[9]) <= 59);
}

function constructs(options: Intl.NumberFormatOptions): boolean {
  try {
    new Intl.NumberFormat("en", options);
    return true;
  } catch {
    return false;
  }
}

/** An ISO 4217 code `Intl` accepts (a well-formed three-letter code). */
export function isCurrencyCode(code: string): boolean {
  return constructs({ style: "currency", currency: code });
}

/** A unit `Intl` formats (`"millisecond"`, `"kilometer-per-hour"`). */
export function isIntlUnit(unit: string): boolean {
  return constructs({ style: "unit", unit });
}

/** Whether a FormatSpec's digit options are a combination `Intl` accepts. */
export function digitsAccepted(options: { readonly minimumFractionDigits?: unknown; readonly maximumFractionDigits?: unknown }): boolean {
  const { minimumFractionDigits: min, maximumFractionDigits: max } = options;
  return typeof min !== "number" || typeof max !== "number" || min <= max;
}
