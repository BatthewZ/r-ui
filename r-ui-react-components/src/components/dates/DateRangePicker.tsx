"use client";
import { CalendarRange, ChevronDown } from "lucide-react";
import { type ComponentPropsWithRef, type CSSProperties, useId, useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { cn, type SlotClassNames } from "../../util/style";
import { Field, Input, useFieldControl, useFieldValue } from "../form";
import { type Placement } from "../../hooks/use-floating";
import { Popover } from "../overlays";
import { Button } from "../primitives";
import { type CalendarCommonProps } from "./calendar-base";
import {
  addDays,
  type DateRange,
  dateFormatter,
  dayNumber,
  formatPattern,
  isOutOfBounds,
  isSameDay,
  resolveLocale,
  startOfDay,
  startOfMonth,
  toISODate,
} from "./date-core";
import { DEFAULT_DATE_ENTRY_LABELS, type DateEntryLabels, EntryMessages, rejectionMessage, useDateText } from "./picker-parts";
import { RangeCalendar } from "./RangeCalendar";
import { type LabelsProp, mergeLabels } from "../../util/labels";

/**
 * A quick range. `range` runs when the preset is chosen, with the current time.
 * Endpoints are the preset's to decide: the calendar-day presets return local
 * midnights (`end` is the last day, inclusive); "Last 24 hours" returns instants.
 */
export interface DateRangePreset {
  id: string;
  label: string;
  range: (now: Date) => { start: Date; end: Date };
}

/** The dashboard defaults. Map over them to translate the labels; pass `[]` for none. */
export const DEFAULT_DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: "last-24-hours", label: "Last 24 hours", range: (now) => ({ start: new Date(now.getTime() - 86_400_000), end: now }) },
  { id: "last-7-days", label: "Last 7 days", range: (now) => ({ start: addDays(now, -6), end: startOfDay(now) }) },
  { id: "last-30-days", label: "Last 30 days", range: (now) => ({ start: addDays(now, -29), end: startOfDay(now) }) },
  { id: "this-month", label: "This month", range: (now) => ({ start: startOfMonth(now), end: startOfDay(now) }) },
];

export interface DateRangePickerLabels extends DateEntryLabels {
  /** The popup's name. */
  dialog: string;
  presets: string;
  start: string;
  end: string;
  apply: string;
  cancel: string;
  /** Empties the committed range. */
  clear: string;
  /** The trigger's text with no range. */
  placeholder: string;
  /** The end typed before the start. */
  endBeforeStart: string;
}

export const DEFAULT_DATE_RANGE_PICKER_LABELS: DateRangePickerLabels = {
  ...DEFAULT_DATE_ENTRY_LABELS,
  dialog: "Choose a date range",
  presets: "Quick ranges",
  start: "Start",
  end: "End",
  apply: "Apply",
  cancel: "Cancel",
  clear: "Clear",
  placeholder: "Select dates",
  endBeforeStart: "The end is before the start.",
};

export interface DateRangePickerProps
  extends Omit<ComponentPropsWithRef<"button">, "value" | "defaultValue" | "onChange" | "children"> {
  value?: DateRange<Date> | null;
  defaultValue?: DateRange<Date> | null;
  /** On a preset, on Apply after a custom range, and `null` on Clear. */
  onValueChange?: (value: DateRange<Date> | null) => void;
  /** The popup (controlled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Quick ranges listed beside the calendar. Default {@link DEFAULT_DATE_RANGE_PRESETS}; `[]` for none. */
  presets?: DateRangePreset[];
  locale?: string;
  weekStartsOn?: CalendarCommonProps["weekStartsOn"];
  /** Months side by side in the popup, while it fits. Default 2. */
  months?: number;
  min?: Date;
  max?: Date;
  isDateUnavailable?: (date: Date) => boolean;
  invalid?: boolean;
  /** Trigger text with no value. Default `labels.placeholder`. */
  placeholder?: string;
  /** @default "bottom-start" */
  placement?: Placement;
  labels?: LabelsProp<DateRangePickerLabels>;
  /** `className` styles the root; `ref` and the rest address the trigger `<button>`. */
  classNames?: SlotClassNames<"trigger" | "panel" | "presets" | "preset" | "calendar">;
}

const EMPTY: DateRange = { start: null, end: null };

const isRangeValue = (raw: unknown): raw is DateRange<Date> =>
  typeof raw === "object" && raw !== null && (raw as DateRange).start instanceof Date && (raw as DateRange).end instanceof Date;

/** Every opening starts from the committed range, as calendar days. */
const draftOf = (committed: DateRange<Date> | null): DateRange =>
  committed ? { start: startOfDay(committed.start), end: startOfDay(committed.end) } : EMPTY;

/** "Oct 1 – 7, 2026" / "1.–7. Okt. 2026": the locale's own compact range. */
function rangeText(value: DateRange<Date>, locale: string): string {
  const format = dateFormatter(locale, { month: "short", day: "numeric", year: "numeric" });
  return isSameDay(value.start, value.end) ? format.format(value.start) : format.formatRange(value.start, value.end);
}

/**
 * The dashboard's time-range control: a trigger at `h-control` that shows the
 * range compactly ("Last 7 days", "Oct 1 – 7, 2026"), and a popup with quick
 * ranges beside typed start and end fields and a `RangeCalendar`.
 *
 * - A preset applies and closes at once. A custom range is a draft until Apply;
 *   Cancel, Escape or a press outside discard it. Clear empties the range.
 * - The popup is in place + top layer (compact in a compact card, never clipped)
 *   and fades out. It is sized from tokens (the preset column and
 *   `months × 7 × --CONTROL-H`, capped at the viewport); presets sit beside the
 *   calendar while the popup's own width holds them, above it when it does not.
 * - A `Field` control: the trigger takes the Field's id, description, error and
 *   disabled state, and its name is the Field's label plus the range.
 * - `name` submits `YYYY-MM-DD/YYYY-MM-DD` (an ISO 8601 interval of calendar days)
 *   in a hidden input.
 */
export function DateRangePicker({
  value,
  defaultValue = null,
  onValueChange,
  presets = DEFAULT_DATE_RANGE_PRESETS,
  locale: localeProp,
  weekStartsOn,
  months = 2,
  min,
  max,
  isDateUnavailable,
  invalid,
  placeholder,
  placement = "bottom-start",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelsProp,
  name,
  form,
  className,
  classNames,
  id: idProp,
  disabled: disabledProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  "aria-label": ariaLabel,
  ...props
}: DateRangePickerProps) {
  const labels = mergeLabels(DEFAULT_DATE_RANGE_PICKER_LABELS, labelsProp);
  const locale = resolveLocale(localeProp);
  const field = useFieldControl({
    id: idProp,
    invalid,
    disabled: disabledProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  // In a Field bound to a Form, the form owns the range (unless the caller passed one).
  const [committed, setCommitted, fieldName] = useFieldValue<DateRange<Date> | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (isRangeValue(raw) ? raw : null),
  });
  const submitName = name ?? fieldName;
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [draft, setDraft] = useState<DateRange>(() => draftOf(committed));
  // Every opening (ours or a controlling parent's) starts from the committed
  // range; closing without Apply discards the draft.
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) setDraft(draftOf(committed));
  }

  const uid = useId();
  const valueId = `${uid}-value`;
  const nameId = `${uid}-name`;
  const preset = committed?.preset ? presets.find((p) => p.id === committed.preset) : undefined;
  const text = committed ? (preset?.label ?? rangeText(committed, locale)) : (placeholder ?? labels.placeholder);

  const commit = (next: DateRange<Date> | null) => {
    setCommitted(next);
    setOpen(false);
  };

  // A named trigger keeps its value in the name: "Time range, Last 7 days".
  const labelledBy = field.labelId ?? (ariaLabel ? nameId : undefined);

  return (
    <div className={cn("inline-flex min-w-0 max-w-full", className)}>
      <Popover open={open} onOpenChange={setOpen} placement={placement}>
        <Popover.Trigger
          {...props}
          id={field.id}
          disabled={field.disabled}
          {...field.ariaProps}
          aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
          variant="secondary"
          iconStart={<CalendarRange />}
          iconEnd={<ChevronDown />}
          className={cn(
            "min-w-0 flex-1",
            // Invalid loses its red in forced colors: a doubled edge is the second cue, as on every field.
            field.invalid &&
              "border-status-error hover:border-status-error forced-colors:border-[length:calc(var(--BORDER-WIDTH)*2)]",
            classNames?.trigger,
          )}
        >
          <span id={valueId} className={cn(!committed && "text-fg-muted")}>
            {text}
          </span>
        </Popover.Trigger>
        <Popover.Content
          aria-label={labels.dialog}
          className={cn(
            "r-dates-panel r-dates-range-panel max-h-[calc(100dvh-var(--R-SIZE-2)*2)] overflow-y-auto",
            classNames?.panel,
          )}
          style={{ "--r-dates-months": Math.max(1, Math.floor(months)), "--r-dates-presets": presets.length > 0 ? 1 : 0 } as CSSProperties}
        >
          <RangePanel
            draft={draft}
            onDraftChange={setDraft}
            presets={presets}
            activePreset={committed?.preset}
            onPreset={(p) => commit({ ...p.range(new Date()), preset: p.id })}
            onApply={() => draft.start && draft.end && commit({ start: draft.start, end: draft.end })}
            onCancel={() => setOpen(false)}
            onClear={committed ? () => commit(null) : undefined}
            locale={locale}
            weekStartsOn={weekStartsOn}
            months={months}
            min={min}
            max={max}
            isDateUnavailable={isDateUnavailable}
            labels={labels}
            classNames={classNames}
          />
        </Popover.Content>
      </Popover>
      {ariaLabel && !field.labelId && (
        <span id={nameId} hidden>
          {ariaLabel}
        </span>
      )}
      {submitName !== undefined && (
        <input
          type="hidden"
          name={submitName}
          form={form}
          disabled={field.disabled}
          value={committed ? `${toISODate(committed.start)}/${toISODate(committed.end)}` : ""}
        />
      )}
    </div>
  );
}

function RangePanel({
  draft,
  onDraftChange,
  presets,
  activePreset,
  onPreset,
  onApply,
  onCancel,
  onClear,
  locale,
  weekStartsOn,
  months,
  min,
  max,
  isDateUnavailable,
  labels,
  classNames,
}: {
  draft: DateRange;
  onDraftChange: (range: DateRange) => void;
  presets: DateRangePreset[];
  activePreset: string | undefined;
  onPreset: (preset: DateRangePreset) => void;
  onApply: () => void;
  onCancel: () => void;
  /** Present while there is a committed range to empty. */
  onClear: (() => void) | undefined;
  locale: string;
  weekStartsOn: DateRangePickerProps["weekStartsOn"];
  months: number;
  min?: Date;
  max?: Date;
  isDateUnavailable?: (date: Date) => boolean;
  labels: DateRangePickerLabels;
  classNames?: DateRangePickerProps["classNames"];
}) {
  const rules = { locale, min, max, isDateUnavailable };
  const pattern = formatPattern(locale, labels.formatLetters);
  // Typing one end keeps the other; an end before the start is refused below.
  const startEntry = useDateText({ value: draft.start, onCommit: (start) => onDraftChange({ ...draft, start }), rules });
  const endEntry = useDateText({ value: draft.end, onCommit: (end) => onDraftChange({ ...draft, end }), rules });
  const reversed = draft.start && draft.end && dayNumber(draft.end) < dayNumber(draft.start);
  const rejected = startEntry.rejected ?? endEntry.rejected;
  const error = rejected
    ? rejectionMessage(rejected, pattern, rules, labels)
    : reversed
      ? labels.endBeforeStart
      : null;
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = error ? errorId : hintId;
  const now = new Date();

  return (
    <div className="@container">
      {/* Explicit one-fraction tracks: an implicit `auto` track would grow to the
          calendar's widest (every month side by side) instead of the panel's width. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-r3 @xl:grid-cols-[var(--COLUMN-SM)_minmax(0,1fr)]">
        {presets.length > 0 && (
          <div
            role="group"
            aria-label={labels.presets}
            className={cn(
              "flex flex-wrap content-start gap-r6 border-b pb-r3 @xl:flex-col @xl:flex-nowrap @xl:border-e @xl:border-b-0 @xl:pe-r3 @xl:pb-0",
              classNames?.presets,
            )}
          >
            {presets.map((p) => {
              const range = p.range(now);
              const outside = isOutOfBounds(range.start, min, max) || isOutOfBounds(range.end, min, max);
              return (
                <Button
                  key={p.id}
                  variant="ghost"
                  aria-pressed={p.id === activePreset}
                  disabled={outside}
                  onClick={() => onPreset(p)}
                  className={cn(
                    "justify-start whitespace-normal text-start aria-pressed:bg-selection aria-pressed:text-fg-on-selection @xl:w-full",
                    classNames?.preset,
                  )}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
        )}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-r3">
          <div className="grid grid-cols-2 gap-r4">
            <Field invalid={Boolean(startEntry.rejected || reversed)}>
              <Field.Label>{labels.start}</Field.Label>
              <Input autoComplete="off" aria-describedby={describedBy} {...startEntry.inputProps} />
            </Field>
            <Field invalid={Boolean(endEntry.rejected || reversed)}>
              <Field.Label>{labels.end}</Field.Label>
              <Input autoComplete="off" aria-describedby={describedBy} {...endEntry.inputProps} />
            </Field>
          </div>
          <EntryMessages hintId={hintId} errorId={errorId} hint={labels.hint(pattern)} error={error} />
          <RangeCalendar
            locale={locale}
            weekStartsOn={weekStartsOn}
            months={months}
            min={min}
            max={max}
            isDateUnavailable={isDateUnavailable}
            labels={labels}
            value={draft}
            className={classNames?.calendar}
            onValueChange={(range) => {
              startEntry.reset();
              endEntry.reset();
              onDraftChange(range);
            }}
          />
          <div className="flex flex-wrap justify-end gap-r4">
            {onClear && (
              <Button variant="ghost" className="me-auto" onClick={onClear}>
                {labels.clear}
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel}>
              {labels.cancel}
            </Button>
            <Button variant="primary" disabled={!draft.start || !draft.end || Boolean(reversed)} onClick={onApply}>
              {labels.apply}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
