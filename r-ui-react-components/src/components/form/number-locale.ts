/**
 * Locale-aware reading of typed numbers, the inverse of `formatNumber`.
 *
 * `Intl` formats but does not parse, so the locale's own symbols are read off
 * `formatToParts` once per locale: group and decimal separators, the minus
 * sign, and its digits (so Arabic-Indic digits read in `ar-EG`). Typed ASCII digits and "-"
 * are always accepted too.
 */

interface LocaleSymbols {
  group: string;
  decimal: string;
  minus: string;
  digits: string[];
}

const cache = new Map<string, LocaleSymbols>();

function symbols(locale: string | undefined): LocaleSymbols {
  const key = locale ?? "";
  let found = cache.get(key);
  if (!found) {
    const parts = new Intl.NumberFormat(locale).formatToParts(-12345.6);
    const part = (type: Intl.NumberFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    const plain = new Intl.NumberFormat(locale, { useGrouping: false });
    found = {
      group: part("group") ?? ",",
      decimal: part("decimal") ?? ".",
      minus: part("minusSign") ?? "-",
      digits: Array.from({ length: 10 }, (_, d) => plain.format(d)),
    };
    cache.set(key, found);
  }
  return found;
}

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
// Spaces a locale may group with (fr uses U+202F, others U+00A0); a typed
// group may use any of them. Two regexes, because a `g` regex's `.test` is stateful.
const SPACE = /[\s\u00a0\u202f]/;
const SPACES = /[\s\u00a0\u202f]/g;
const BIDI_MARKS = /[\u200e\u200f\u061c]/g;

/**
 * Reads `text` typed in `locale`. Returns `null` for an empty field and `NaN`
 * for text that is not a plain decimal number (exponents, hex and "Infinity"
 * are refused: no one means those in a form field).
 */
export function parseLocaleNumber(text: string, locale?: string): number | null {
  const { group, decimal, digits, minus: localeMinus } = symbols(locale);
  const minus = localeMinus.replace(BIDI_MARKS, "");
  // Bidi marks some locales put around signs and digits carry no value.
  let s = text.replace(BIDI_MARKS, "").trim();
  if (s === "") return null;
  digits.forEach((digit, d) => {
    if (digit !== String(d)) s = s.split(digit).join(String(d));
  });
  s = s.split(minus).join("-").replace(/\u2212/g, "-");
  if (SPACE.test(group)) s = s.replace(SPACES, "");
  else s = s.split(group).join("");
  if (decimal !== ".") s = s.split(decimal).join(".");
  if (!DECIMAL.test(s)) return Number.NaN;
  return Number(s);
}
