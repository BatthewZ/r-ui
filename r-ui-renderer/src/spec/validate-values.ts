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

/** Whether a FormatSpec's digit options are a combination `Intl` accepts. */
export function digitsAccepted(options: { readonly minimumFractionDigits?: unknown; readonly maximumFractionDigits?: unknown }): boolean {
  const { minimumFractionDigits: min, maximumFractionDigits: max } = options;
  return typeof min !== "number" || typeof max !== "number" || min <= max;
}
