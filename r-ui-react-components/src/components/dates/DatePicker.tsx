"use client";
import { CalendarDays } from "lucide-react";
import { type ComponentPropsWithRef, type ReactNode, useId, useState } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { Input, useField, useFieldMessage, useFieldValue } from "../form";
import { Popover } from "../overlays";
import { IconButton } from "../primitives";
import { Calendar } from "./Calendar";
import { type CalendarCommonProps } from "./calendar-base";
import { formatPattern, isSameDay, resolveLocale, startOfDay, toISODate } from "./date-core";
import {
  DEFAULT_DATE_ENTRY_LABELS,
  type DateEntryLabels,
  EntryMessages,
  rejectionMessage,
  useDateText,
} from "./picker-parts";

export interface DatePickerLabels extends DateEntryLabels {
  /** The calendar button's name, and the popup's. */
  chooseDate: string;
}

export const DEFAULT_DATE_PICKER_LABELS: DatePickerLabels = {
  ...DEFAULT_DATE_ENTRY_LABELS,
  chooseDate: "Choose date",
};

export interface DatePickerProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    "value" | "defaultValue" | "onChange" | "min" | "max" | "type" | "size" | "children"
  > {
  /** A calendar date (local midnight; a time of day is ignored), or `null` for none. */
  value?: Date | null;
  defaultValue?: Date | null;
  /** The committed date: after a pick, or a typed date on blur / Enter. `null` when cleared. */
  onValueChange?: (date: Date | null) => void;
  /** Reads and writes dates in this locale's order and names. Defaults to the runtime's. */
  locale?: string;
  weekStartsOn?: CalendarCommonProps["weekStartsOn"];
  /** Months side by side in the popup, while it fits. */
  months?: number;
  min?: Date;
  max?: Date;
  isDateUnavailable?: (date: Date) => boolean;
  invalid?: boolean;
  /** The line under the field. Defaults to the locale's pattern ("MM/DD/YYYY"); `null` hides it. */
  hint?: ReactNode;
  labels?: Partial<DatePickerLabels>;
  /** `className` styles the field's frame. */
  classNames?: SlotClassNames<"root" | "input" | "button" | "hint" | "error" | "panel" | "calendar">;
}

/**
 * A date field: type a date in the user's locale, or open a calendar.
 *
 * - The input reads what the locale writes ("10/15/2026" in en-US, "15.10.2026"
 *   in de-DE, ISO anywhere, month names too) and shows the committed value in the
 *   locale's numeric form; the pattern is shown under it.
 * - A refused entry (unreadable, outside `min`/`max`, unavailable) stays in the
 *   field, marks it `aria-invalid`, and its reason replaces the hint in the Field
 *   error's look, wired through `aria-describedby`. The value is unchanged.
 * - The button opens the calendar in a popup (the WAI-ARIA APG date picker
 *   dialog): rendered in place and promoted to the top layer, so a compact card
 *   gets a compact calendar and no `overflow` clips it; focus lands on the chosen
 *   day (else today); Escape closes it and focus returns to the button; it fades
 *   out.
 * - A `Field` control: id, label, description, error, required, disabled and
 *   read-only come from the surrounding `Field`, as for `Input`.
 * - `name` submits the date as `YYYY-MM-DD` in a hidden input (the visible text
 *   is localised and is not submitted).
 */
export function DatePicker({
  value,
  defaultValue = null,
  onValueChange,
  locale: localeProp,
  weekStartsOn,
  months,
  min,
  max,
  isDateUnavailable,
  invalid,
  hint,
  labels: labelsProp,
  name,
  form,
  className,
  classNames,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  "aria-describedby": describedBy,
  onBlur,
  onKeyDown,
  ...props
}: DatePickerProps) {
  const labels = { ...DEFAULT_DATE_PICKER_LABELS, ...labelsProp };
  const locale = resolveLocale(localeProp);
  const field = useField();
  const disabled = disabledProp ?? field?.disabled ?? false;
  const readOnly = readOnlyProp ?? field?.readOnly ?? false;
  const [open, setOpen] = useState(false);
  // In a Field bound to a Form, the form owns the date (unless the caller passed one).
  const [selected, setSelected, fieldName] = useFieldValue<Date | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    isEqual: isSameDay,
    fromForm: (raw) => (raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw : null),
  });
  const submitName = name ?? fieldName;

  const rules = { locale, min, max, isDateUnavailable };
  const entry = useDateText({ value: selected, onCommit: setSelected, rules });
  const pattern = formatPattern(locale, labels.formatLetters);
  const error = entry.rejected ? rejectionMessage(entry.rejected.reason, entry.rejected.text, pattern, rules, labels) : null;
  const hintContent = hint === undefined ? labels.hint(pattern) : hint;
  const hintShown = hintContent != null && hintContent !== false && !error;

  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Inside a Field, a refused entry also makes the Field invalid and joins its
  // description, beside the Field's own messages (the form's included).
  useFieldMessage("error", errorId, error !== null);

  return (
    <div className={cn("grid min-w-0 gap-r5", classNames?.root)}>
      <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
        <Input
          {...props}
          type="text"
          autoComplete="off"
          form={form}
          disabled={disabled}
          readOnly={readOnly}
          invalid={entry.rejected ? true : invalid}
          aria-describedby={[describedBy, error ? errorId : hintShown ? hintId : undefined].filter(Boolean).join(" ") || undefined}
          className={className}
          classNames={{ input: classNames?.input }}
          {...entry.inputProps}
          onBlur={(event) => {
            onBlur?.(event);
            entry.inputProps.onBlur();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) entry.inputProps.onKeyDown(event);
          }}
          end={
            <Popover.Trigger asChild>
              <IconButton
                label={labels.chooseDate}
                icon={<CalendarDays />}
                disabled={disabled || readOnly}
                className={classNames?.button}
              />
            </Popover.Trigger>
          }
        />
        <Popover.Content
          aria-label={labels.chooseDate}
          // The calendar focuses its own active day: the grid, not "Previous month".
          initialFocus={-1}
          className={cn("w-max max-w-[calc(100vw-var(--R-SIZE-2)*2)]", classNames?.panel)}
        >
          <Calendar
            autoFocus
            locale={locale}
            weekStartsOn={weekStartsOn}
            months={months}
            min={min}
            max={max}
            isDateUnavailable={isDateUnavailable}
            labels={labels}
            value={selected}
            className={classNames?.calendar}
            onValueChange={(date) => {
              entry.reset();
              setSelected(startOfDay(date));
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover>
      {submitName !== undefined && (
        <input type="hidden" name={submitName} form={form} disabled={disabled} value={selected ? toISODate(selected) : ""} />
      )}
      <EntryMessages
        hintId={hintId}
        errorId={errorId}
        hint={hintContent}
        error={error}
        classNames={{ hint: classNames?.hint, error: classNames?.error }}
      />
    </div>
  );
}
