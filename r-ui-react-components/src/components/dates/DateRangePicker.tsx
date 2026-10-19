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
import { TimeField } from "./TimeField";
import { formatTimeValue, parseTimeValue, timeOf, toISODateTime, withTimeOfDay } from "./time-core";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";

/**
 * A quick range. `range` runs when the preset is chosen, with the current time
 * and whether the picker keeps times (`withTime`). Endpoints are the preset's to
 * decide, and are kept as returned: the calendar-day presets return local
 * midnights (`end` is the last day, inclusive) without times and a rolling
 * window ending now with them; "Last 24 hours" returns instants either way.
 */
export interface DateRangePreset {
  id: string;
  label: string;
  /** `context` is omitted by callers that predate times: read it as date-only. */
  range: (now: Date, context?: { withTime: boolean }) => { start: Date; end: Date };
}

/** Calendar days ending today; with times, the same wall-clock time `days` days ago up to now. */
const lastDays =
  (days: number): DateRangePreset["range"] =>
  (now, context) => {
    if (!context?.withTime) return { start: addDays(now, 1 - days), end: startOfDay(now) };
    const start = new Date(now.getTime());
    start.setDate(start.getDate() - days);
    return { start, end: now };
  };

/** The dashboard defaults. Map over them to translate the labels; pass `[]` for none. */
export const DEFAULT_DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: "last-24-hours", label: "Last 24 hours", range: (now) => ({ start: new Date(now.getTime() - 86_400_000), end: now }) },
  { id: "last-7-days", label: "Last 7 days", range: lastDays(7) },
  { id: "last-30-days", label: "Last 30 days", range: lastDays(30) },
  {
    id: "this-month",
    label: "This month",
    range: (now, context) => ({ start: startOfMonth(now), end: context?.withTime ? now : startOfDay(now) }),
  },
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
  /** With `withTime`: the start's and end's time fields. */
  startTime: string;
  endTime: string;
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
  startTime: "Start time",
  endTime: "End time",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    DateRangePicker: DateRangePickerLabels;
  }
}

export interface DateRangePickerProps
  extends Omit<ComponentPropsWithRef<"button">, "value" | "defaultValue" | "onChange" | "children"> {
  value?: DateRange<Date> | null;
  defaultValue?: DateRange<Date> | null;
  /** On a preset, on Apply after a custom range, and `null` on Clear. */
  onValueChange?: (value: DateRange<Date> | null) => void;
  /**
   * A time of day on each end: a `TimeField` beside the typed start and end
   * (00:00 and 23:59 until set). `start` and `end` are then `Date`s at local
   * wall-clock times (real instants in the user's zone, `end` the last one);
   * without it they are local midnights and `end` is the last whole day. A
   * wall-clock time a DST change skips moves forward by the gap, and one it
   * repeats is the earlier instant. `name` then submits
   * `YYYY-MM-DDTHH:mm±hh:mm/YYYY-MM-DDTHH:mm±hh:mm`.
   */
  withTime?: boolean;
  /** With `withTime`: minutes per arrow press on the times' minutes. @default 1 */
  timeStep?: number;
  /** With `withTime`: a 12- or 24-hour clock. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** The popup (controlled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Quick ranges listed beside the calendar. Default {@link DEFAULT_DATE_RANGE_PRESETS}; `[]` for none. */
  presets?: DateRangePreset[];
  /**
   * The instant the presets resolve against, for an app whose "now" is its
   * data's rather than the device's (a frozen specimen, a replay). Omitted: the
   * device's clock, read when the panel draws and when a preset is chosen.
   */
  now?: Date;
  /** Names, order and week start of the calendar and the typed entry. Defaults to the `LocaleProvider`'s, else the runtime's. */
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

/** Each end's time of day in the draft (`HH:mm`), `null` while its field is incomplete. */
interface DraftTimes {
  start: string | null;
  end: string | null;
}

/** Every opening starts from the committed range: its calendar days, and its wall-clock times. */
const draftOf = (committed: DateRange<Date> | null): DateRange =>
  committed ? { start: startOfDay(committed.start), end: startOfDay(committed.end) } : EMPTY;
const timesOf = (committed: DateRange<Date> | null): DraftTimes =>
  committed
    ? { start: formatTimeValue(timeOf(committed.start)), end: formatTimeValue(timeOf(committed.end)) }
    : { start: "00:00", end: "23:59" };

/** The draft's ends at their times, or `null` while a day or a time is missing. */
function timedRange(draft: DateRange, times: DraftTimes): DateRange<Date> | null {
  const start = parseTimeValue(times.start);
  const end = parseTimeValue(times.end);
  if (!draft.start || !draft.end || !start || !end) return null;
  return { start: withTimeOfDay(draft.start, start), end: withTimeOfDay(draft.end, end) };
}

/**
 * "Oct 1 – 7, 2026" / "1.–7. Okt. 2026": the locale's own compact range; with
 * times, "Oct 15, 2026, 9:00 AM – 5:30 PM".
 */
function rangeText(value: DateRange<Date>, locale: string, withTime: boolean, hourCycle: 12 | 24 | undefined): string {
  const format = dateFormatter(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit", ...(hourCycle ? { hourCycle: hourCycle === 12 ? "h12" : "h23" } : {}) } : {}),
  });
  if (withTime ? value.start.getTime() === value.end.getTime() : isSameDay(value.start, value.end)) {
    return format.format(value.start);
  }
  return format.formatRange(value.start, value.end);
}

/** The hidden input's value: an ISO 8601 interval of calendar days, or of offset date-times. */
const wireOf = (value: DateRange<Date>, withTime: boolean) =>
  withTime
    ? `${toISODateTime(value.start)}/${toISODateTime(value.end)}`
    : `${toISODate(value.start)}/${toISODate(value.end)}`;

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
 * - `withTime` adds a `TimeField` beside each typed end, so a range can be
 *   2026-10-15 09:00 → 17:30 (see the prop).
 */
export function DateRangePicker({
  value,
  defaultValue = null,
  onValueChange,
  withTime = false,
  timeStep,
  hourCycle,
  presets = DEFAULT_DATE_RANGE_PRESETS,
  now,
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
  const labels = useLabels("DateRangePicker", DEFAULT_DATE_RANGE_PICKER_LABELS, labelsProp);
  const locale = resolveLocale(useLocale(localeProp));
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
  const [times, setTimes] = useState<DraftTimes>(() => timesOf(committed));
  // Every opening (ours or a controlling parent's) starts from the committed
  // range; closing without Apply discards the draft.
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) {
      setDraft(draftOf(committed));
      setTimes(timesOf(committed));
    }
  }

  const uid = useId();
  const valueId = `${uid}-value`;
  const nameId = `${uid}-name`;
  const preset = committed?.preset ? presets.find((p) => p.id === committed.preset) : undefined;
  const text = committed ? (preset?.label ?? rangeText(committed, locale, withTime, hourCycle)) : (placeholder ?? labels.placeholder);

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
          // Stretched (a form row, a filter bar) it reads as a field: the value at the
          // start, the chevron at the end. At its own width nothing moves.
          classNames={{ label: "flex-1 text-start" }}
          className={cn(
            // `*:flex-1`: the button's content row fills it, so the label can push the chevron out.
            "min-w-0 flex-1 *:flex-1",
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
            now={now}
            onPreset={(p) => commit({ ...p.range(now ?? new Date(), { withTime }), preset: p.id })}
            onApply={() => {
              const range = withTime ? timedRange(draft, times) : draft.start && draft.end ? { start: draft.start, end: draft.end } : null;
              if (range) commit(range);
            }}
            withTime={withTime}
            times={times}
            onTimesChange={setTimes}
            timeStep={timeStep}
            hourCycle={hourCycle}
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
          value={committed ? wireOf(committed, withTime) : ""}
        />
      )}
    </div>
  );
}

function RangePanel({
  draft,
  onDraftChange,
  withTime,
  times,
  onTimesChange,
  timeStep,
  hourCycle,
  presets,
  now: nowProp,
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
  withTime: boolean;
  times: DraftTimes;
  onTimesChange: (times: DraftTimes) => void;
  timeStep: number | undefined;
  hourCycle: 12 | 24 | undefined;
  presets: DateRangePreset[];
  now: Date | undefined;
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
  const timed = withTime ? timedRange(draft, times) : null;
  const reversed = timed
    ? timed.end.getTime() < timed.start.getTime()
    : Boolean(draft.start && draft.end && dayNumber(draft.end) < dayNumber(draft.start));
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
  const now = nowProp ?? new Date();

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
              const range = p.range(now, { withTime });
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
          {withTime ? (
            // A row per end: the typed day, its time beside it while the panel's
            // width holds both, under it when it does not.
            <div className="grid gap-r4">
              {(["start", "end"] as const).map((end) => {
                const entry = end === "start" ? startEntry : endEntry;
                return (
                  <div key={end} className="flex flex-wrap items-end gap-r6">
                    <Field invalid={Boolean(entry.rejected || reversed)} className="min-w-0 flex-[1_1_calc(var(--CONTROL-H)*4)]">
                      <Field.Label>{labels[end]}</Field.Label>
                      <Input autoComplete="off" aria-describedby={describedBy} {...entry.inputProps} />
                    </Field>
                    <TimeField
                      aria-label={end === "start" ? labels.startTime : labels.endTime}
                      value={times[end]}
                      onValueChange={(time) => onTimesChange({ ...times, [end]: time })}
                      invalid={Boolean(reversed)}
                      step={timeStep}
                      hourCycle={hourCycle}
                      locale={locale}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
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
          )}
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
            <Button
              variant="primary"
              disabled={!draft.start || !draft.end || (withTime && !timed) || reversed}
              onClick={onApply}
            >
              {labels.apply}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
