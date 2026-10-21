/**
 * The `Intl` input the renderer checks before a value reaches a component:
 * the codes and option combinations `Intl` throws on. Shared by the renderer
 * and the validator.
 */

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

/** Styles whose fraction digits reach `Intl` as written: `integer` sets its own, dates read none. */
const FRACTION_DIGIT_STYLES: ReadonlySet<unknown> = new Set(["number", "compact", "percent", "delta", "bytes", "currency", "unit"]);

/**
 * Whether a FormatSpec's digit options are a combination `Intl` accepts.
 * Crossed fraction digits are refused only where they are read: significant
 * digits take over from them, and some styles never pass them on.
 */
export function digitsAccepted(options: {
  readonly style?: unknown;
  readonly minimumFractionDigits?: unknown;
  readonly maximumFractionDigits?: unknown;
  readonly maximumSignificantDigits?: unknown;
}): boolean {
  const { style, minimumFractionDigits: min, maximumFractionDigits: max, maximumSignificantDigits: significant } = options;
  if (typeof significant === "number" || (style !== undefined && !FRACTION_DIGIT_STYLES.has(style))) return true;
  return typeof min !== "number" || typeof max !== "number" || min <= max;
}
