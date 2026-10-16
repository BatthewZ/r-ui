"use client";
import { type ChangeEvent, type FocusEvent, type KeyboardEvent, useId } from "react";

import { formatNumber } from "../../util/format";
import { useLocale } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { cn } from "../../util/style";

import { useField, useFieldValue } from "./Field";
import { Input, type InputProps } from "./Input";
import { clampNumber, roundTo, useNumberDraft } from "./number-draft";
import { parseLocaleNumber } from "./number-locale";

export interface CurrencyInputProps extends Omit<
  InputProps,
  "type" | "value" | "defaultValue" | "inputMode" | "min" | "max" | "step" | "start"
> {
  /** ISO 4217 code (`"EUR"`, `"JPY"`). Sets the symbol and the fraction digits (2, 0 for JPY, 3 for BHD). */
  currency: string;
  /**
   * The amount, `null` for an empty field. In major units (12.5 is €12.50)
   * unless `minorUnits`.
   */
  value?: number | null;
  defaultValue?: number | null;
  /** The committed amount: on blur or Enter, never mid-typing. */
  onValueChange?: (value: number | null) => void;
  /** The value is an integer in the currency's minor unit (1250 is €12.50; 1250 is ¥1,250). */
  minorUnits?: boolean;
  /** Bounds, in the same units as the value. A committed amount is clamped to them. */
  min?: number;
  max?: number;
  /** Negative amounts (a refund, an adjustment): a minus or accounting brackets. @default false */
  allowNegative?: boolean;
  /** How the currency is named beside the amount. @default "symbol" */
  currencyDisplay?: "symbol" | "narrowSymbol" | "code";
  /** BCP 47 locale for the separators typed and shown. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
}

interface CurrencyFormat {
  /** Fraction digits the currency uses. */
  digits: number;
  /** The currency's sign as the locale writes it, and on which side of the amount. */
  symbol: string;
  symbolAtEnd: boolean;
}

const formats = new Map<string, CurrencyFormat>();

function currencyFormat(
  locale: string | undefined,
  currency: string,
  display: CurrencyInputProps["currencyDisplay"],
): CurrencyFormat {
  const key = JSON.stringify([locale ?? null, currency, display]);
  let found = formats.get(key);
  if (!found) {
    const intl = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: display,
    });
    const parts = intl.formatToParts(1);
    const at = parts.findIndex((part) => part.type === "currency");
    found = {
      digits: intl.resolvedOptions().maximumFractionDigits ?? 2,
      symbol: parts[at]?.value ?? currency,
      symbolAtEnd: at > parts.findIndex((part) => part.type === "integer"),
    };
    formats.set(key, found);
  }
  return found;
}

const BRACKETED = /^\s*\((.*)\)\s*$/s;

/**
 * Money, typed in the locale's own separators ("1.234,5" in German) and shown
 * formatted to the currency's precision once the field is left ("1.234,50").
 * The currency's sign sits beside the amount on the side the locale puts it,
 * and describes the field. Reads typed text with `NumberInput`'s parser and
 * edits like it (a draft committed on blur or Enter; unreadable text reverts;
 * empty is `null`), without the steppers: amounts are typed, not nudged. A
 * pasted sign ("€1,234.50") is ignored; with `allowNegative`, a minus or
 * accounting brackets make it negative. Binds to a `Form` through `Field name`;
 * `name` submits the number from a hidden input.
 */
export function CurrencyInput({
  currency,
  value,
  defaultValue = null,
  onValueChange,
  minorUnits = false,
  min,
  max,
  allowNegative = false,
  currencyDisplay = "symbol",
  locale: localeProp,
  name,
  form,
  end,
  classNames,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  "aria-describedby": describedByProp,
  ...props
}: CurrencyInputProps) {
  const locale = useLocale(localeProp);
  const field = useField();
  const symbolId = `${useId()}-currency`;
  const { digits, symbol, symbolAtEnd } = currencyFormat(locale, currency, currencyDisplay);
  const scale = 10 ** digits;
  const [stored, setStored, fieldName] = useFieldValue<number | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : null),
  });
  // The field edits major units; the value may be minor ones.
  const toMajor = (n: number | null) => (n === null || !minorUnits ? n : n / scale);
  const toStored = (n: number | null) => (n === null || !minorUnits ? n : Math.round(n * scale));
  const locked = (props.disabled ?? field?.disabled) === true || (props.readOnly ?? field?.readOnly) === true;
  const lowest = allowNegative ? toMajor(min ?? null) : Math.max(0, toMajor(min ?? null) ?? 0);
  const highest = toMajor(max ?? null);

  const format = (n: number | null) =>
    formatNumber(n, {
      locale,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      missing: "",
    });

  const draft = useNumberDraft({
    current: toMajor(stored),
    setValue: (major) => setStored(toStored(major)),
    format,
    parse: (text) => {
      const bracketed = BRACKETED.exec(text);
      const unsigned = (bracketed?.[1] ?? text).split(symbol).join("").split(currency).join("");
      const parsed = parseLocaleNumber(unsigned, locale);
      if (parsed === null || Number.isNaN(parsed)) return bracketed ? Number.NaN : parsed;
      const signed = bracketed ? -Math.abs(parsed) : parsed;
      return signed < 0 && !allowNegative ? Number.NaN : signed;
    },
    settle: (n) => clampNumber(roundTo(n, digits), lowest ?? undefined, highest ?? undefined),
    locked,
  });

  const sign = (
    <span id={symbolId} className="text-body-1">
      {symbol}
    </span>
  );

  const submitName = name ?? fieldName;

  return (
    <>
      <Input
        {...props}
        form={form}
        type="text"
        inputMode="decimal"
        autoComplete={props.autoComplete ?? "off"}
        value={draft.text}
        aria-describedby={[describedByProp, symbolId].filter(Boolean).join(" ")}
        onFocus={composeEventHandlers(onFocus, (event: FocusEvent<HTMLInputElement>) => draft.onFocus(event.target.value))}
        onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => draft.onChange(event.target.value))}
        onBlur={composeEventHandlers(onBlur, draft.onBlur)}
        onKeyDown={composeEventHandlers(onKeyDown, (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") draft.commitDraft();
        })}
        classNames={{
          ...classNames,
          input: cn("tabular-nums", classNames?.input),
        }}
        start={symbolAtEnd ? undefined : sign}
        end={
          symbolAtEnd ? (
            <>
              {sign}
              {end}
            </>
          ) : (
            end
          )
        }
      />
      {/* The amount as a number (in the value's units), not the text shown. */}
      {submitName && <input type="hidden" name={submitName} value={stored === null ? "" : String(stored)} form={form} />}
    </>
  );
}
