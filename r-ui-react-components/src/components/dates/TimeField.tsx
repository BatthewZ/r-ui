"use client";
import {
  type ClipboardEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { ErrorLine } from "../../util/error-line";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { useFieldControl, useFieldMessage, useFieldValue } from "../form";
import { resolveLocale } from "./date-core";
import {
  clockHour,
  digitOf,
  formatTimeLabel,
  formatTimeValue,
  type HourCycle,
  hourCycleFor,
  isTimeAllowed,
  isTwelveHour,
  parseTimeValue,
  segmentTexts,
  type TimeParts,
  type TimeSegmentType,
  timeLayout,
} from "./time-core";

/** Every string a time field speaks. */
export interface TimeFieldLabels {
  /** The field's name when no Field label, `aria-label` or `aria-labelledby` gives one. */
  label: string;
  /** Each segment's name, read after the field's ("Start time Hours"). */
  hour: string;
  minute: string;
  second: string;
  dayPeriod: string;
  /** An empty segment's spoken value. */
  empty: string;
  /** What an empty segment shows. */
  placeholder: string;
  /** Focus left the field with some segments still empty. */
  incomplete: string;
  /** A time outside `min`/`max`; each bound already formatted, `undefined` when open. */
  outOfRange: (bounds: { min?: string; max?: string }) => string;
}

export const DEFAULT_TIME_FIELD_LABELS: TimeFieldLabels = {
  label: "Time",
  hour: "Hours",
  minute: "Minutes",
  second: "Seconds",
  dayPeriod: "AM/PM",
  empty: "Empty",
  placeholder: "––",
  incomplete: "Enter a complete time.",
  outOfRange: ({ min, max }) =>
    min && max ? `Choose a time from ${min} to ${max}.` : min ? `Choose ${min} or later.` : `Choose ${max} or earlier.`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    TimeField: TimeFieldLabels;
  }
}

export interface TimeFieldProps extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "children"> {
  /**
   * A wall-clock time of day, 24-hour `HH:mm` (`HH:mm:ss` with `withSeconds`), or
   * `null` for none. No date and no zone: "09:00" is nine on the clock.
   */
  value?: string | null;
  defaultValue?: string | null;
  /**
   * The time the segments show, once it is complete and inside `min`/`max`;
   * `null` while a segment is empty or the time is refused.
   */
  onValueChange?: (value: string | null) => void;
  /** Adds a seconds segment; the value becomes `HH:mm:ss`. */
  withSeconds?: boolean;
  /** 12 (with AM/PM) or 24 hours. Defaults to the locale's clock. */
  hourCycle?: 12 | 24;
  /** Segment order, digits, separators and day-period words. Defaults to the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** Earliest time, `HH:mm`. A `min` after `max` is a window across midnight (22:00–06:00). */
  min?: string;
  /** Latest time, `HH:mm`, inclusive. */
  max?: string;
  /**
   * Minutes per arrow press on the minutes segment (and a `TimePicker`'s list
   * stride). Arrows snap to multiples of it; typing stays exact. @default 1
   */
  step?: number;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Submits the value (`HH:mm`) in a hidden input. Inside a `Field`, defaults to the Field's. */
  name?: string;
  form?: string;
  /** Trailing adornment inside the frame (a `TimePicker`'s button). */
  end?: ReactNode;
  labels?: LabelsProp<TimeFieldLabels>;
  /** `className` styles the root (the frame and the line under it); `ref` and the rest address the frame (`role="group"`). */
  classNames?: SlotClassNames<"frame" | "segment" | "literal" | "error">;
}

/** Segment values in the field's own numbering: the hour on its cycle's clock; dayPeriod 0 = AM, 1 = PM. */
type Segments = Record<TimeSegmentType, number | null>;

const EMPTY: Segments = { hour: null, minute: null, second: null, dayPeriod: null };

function toSegments(t: TimeParts | null, cycle: HourCycle): Segments {
  if (!t) return EMPTY;
  const dayPeriod = isTwelveHour(cycle) ? (t.hour >= 12 ? 1 : 0) : null;
  return { hour: clockHour(t.hour, cycle), minute: t.minute, second: t.second, dayPeriod };
}

/** The 24-hour time the segments name, or `null` while one of `order` is empty. */
function toTime(s: Segments, order: TimeSegmentType[], cycle: HourCycle): TimeParts | null {
  if (order.some((type) => s[type] === null)) return null;
  const hour = s.hour ?? 0;
  return {
    hour: isTwelveHour(cycle) ? (hour % 12) + (s.dayPeriod ?? 0) * 12 : hour,
    minute: s.minute ?? 0,
    second: order.includes("second") ? (s.second ?? 0) : 0,
  };
}

function rangeOf(type: TimeSegmentType, cycle: HourCycle): [number, number] {
  if (type === "hour") return cycle === "h12" ? [1, 12] : cycle === "h11" ? [0, 11] : [0, 23];
  return type === "dayPeriod" ? [0, 1] : [0, 59];
}

/** The next value on the segment's stride, wrapping within it; from empty, the first (up) or last (down). */
function stepValue(value: number | null, delta: 1 | -1, [lo, hi]: [number, number], stride: number): number {
  const last = lo + Math.floor((hi - lo) / stride) * stride;
  if (value === null) return delta > 0 ? lo : last;
  if (delta > 0) {
    const next = lo + Math.floor((value - lo) / stride) * stride + stride;
    return next > hi ? lo : next;
  }
  const prev = lo + Math.ceil((value - lo) / stride) * stride - stride;
  return prev < lo ? last : prev;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{L}]/gu, "");

/**
 * The day period a typed letter picks: A or P in every locale, else the first
 * letter of the locale's own word where the two words differ there
 * ("ص" / "م" in Arabic; 오전 / 오후 share theirs, so Korean takes only A / P).
 */
function periodFor(ch: string, am: string, pm: string): 0 | 1 | null {
  const key = fold(ch);
  if (key === "a") return 0;
  if (key === "p") return 1;
  const [a, p] = [fold(am), fold(pm)];
  if (key === "" || a[0] === p[0]) return null;
  return a.startsWith(key) ? 0 : p.startsWith(key) ? 1 : null;
}

/**
 * A time of day as one field of segments: hours, minutes, optional seconds and,
 * on a 12-hour clock, AM/PM, in the locale's order with its separators and digits.
 *
 * - Each segment is a `spinbutton` (WAI-ARIA APG) and its own tab stop. Up and
 *   Down step it and wrap (59 → 00; the minutes by `step`, snapping to it), Home
 *   and End go to its ends, Left and Right move between segments, digits type
 *   (a digit that cannot start a longer number completes the segment and moves
 *   on: "9" then "3" is 09 and minutes "3…"), A / P set the day period, a
 *   separator moves on, Backspace empties a segment (on an empty one, it moves
 *   back). A pasted "14:30" fills every segment. The segments are editable
 *   regions so a touch keyboard opens on its number pad; nothing they receive
 *   reaches the DOM except through these rules.
 * - The value is the time the segments show once it is complete and allowed
 *   (`min`/`max`, a window across midnight included); otherwise `null`. A refused
 *   time stays on show with its reason under the field; leaving the field with
 *   some segments empty says so too. Both are wired through `aria-describedby`
 *   and make a surrounding `Field` invalid.
 * - The segments stay in the locale's order left to right in a right-to-left
 *   page, the way the time is written there.
 * - A `Field` control: the group takes the Field's id, label, description,
 *   error, required, disabled and read-only. `name` submits `HH:mm` (24-hour) in
 *   a hidden input.
 */
export function TimeField({
  value,
  defaultValue = null,
  onValueChange,
  withSeconds = false,
  hourCycle,
  locale: localeProp,
  min,
  max,
  step = 1,
  invalid: invalidProp,
  required: requiredProp,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  name,
  form,
  end,
  labels: labelsProp,
  className,
  classNames,
  id: idProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  onMouseDown,
  onBlur,
  ...props
}: TimeFieldProps) {
  const labels = useLabels("TimeField", DEFAULT_TIME_FIELD_LABELS, labelsProp);
  const locale = resolveLocale(useLocale(localeProp));
  const cycle = hourCycleFor(locale, hourCycle);
  const layout = useMemo(() => timeLayout(locale, cycle, withSeconds), [locale, cycle, withSeconds]);
  const order = useMemo(
    () => layout.parts.flatMap((p) => (p.type === "literal" ? [] : [p.type])),
    [layout],
  );

  const [committed, setCommitted, fieldName] = useFieldValue<string | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "string" && parseTimeValue(raw) ? raw : null),
  });
  const submitName = name ?? fieldName;

  // The segments are the source of what shows; the value follows them. A value
  // that moves from outside (a parent, the form, a reset) re-seeds them; the
  // value this field just sent does not, so a half-typed time survives its `null`.
  const [segments, setSegments] = useState(() => toSegments(parseTimeValue(committed), cycle));
  const [seen, setSeen] = useState({ committed, cycle });
  if (seen.committed !== committed || seen.cycle !== cycle) {
    setSeen({ committed, cycle });
    setSegments(toSegments(parseTimeValue(committed), cycle));
  }
  const [leftIncomplete, setLeftIncomplete] = useState(false);

  const minTime = parseTimeValue(min);
  const maxTime = parseTimeValue(max);
  const time = toTime(segments, order, cycle);
  const outOfRange = time !== null && !isTimeAllowed(time, minTime, maxTime);
  const label = (t: TimeParts | null) => (t ? formatTimeLabel(t, locale, cycle) : undefined);
  const error = outOfRange
    ? labels.outOfRange({ min: label(minTime), max: label(maxTime) })
    : leftIncomplete
      ? labels.incomplete
      : null;

  const uid = useId();
  const errorId = `${uid}-error`;
  const nameId = `${uid}-name`;
  useFieldMessage("error", errorId, error !== null);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": [describedByProp, error ? errorId : undefined].filter(Boolean).join(" ") || undefined,
    "aria-invalid": ariaInvalidProp,
  });
  const ariaInvalid = field.ariaProps["aria-invalid"];
  const invalid = field.invalid || error !== null || ariaInvalid === true || ariaInvalid === "true";
  const disabled = field.disabled ?? false;
  const editable = !disabled && !field.readOnly;
  const nameIds = ariaLabelledBy ?? field.labelId ?? nameId;

  const update = (next: Segments) => {
    setSegments(next);
    setLeftIncomplete(false);
    const t = toTime(next, order, cycle);
    const out = t && isTimeAllowed(t, minTime, maxTime) ? formatTimeValue(t, withSeconds) : null;
    if (out !== committed) {
      setSeen({ committed: out, cycle });
      setCommitted(out);
    }
  };

  const refs = useRef(new Map<TimeSegmentType, HTMLElement>());
  /** Digits typed into the focused segment so far ("1" waiting for "0"–"2"). */
  const typing = useRef<{ type: TimeSegmentType; text: string } | null>(null);
  const focusSegment = (type: TimeSegmentType | undefined) => {
    if (type) refs.current.get(type)?.focus();
  };
  const neighbour = (type: TimeSegmentType, delta: 1 | -1) => order[order.indexOf(type) + delta];
  const stride = (type: TimeSegmentType) => (type === "minute" ? Math.min(60, Math.max(1, Math.round(step))) : 1);

  const typeText = (type: TimeSegmentType, ch: string) => {
    if (type === "dayPeriod") {
      const period = periodFor(ch, layout.am, layout.pm);
      if (period !== null) {
        update({ ...segments, dayPeriod: period });
        focusSegment(neighbour(type, 1));
      }
      return;
    }
    const digit = digitOf(ch);
    if (digit === null) {
      // A separator ("：", ".", a space) moves on from a filled segment.
      if (/[\p{P}\p{Zs}]/u.test(ch) && segments[type] !== null) focusSegment(neighbour(type, 1));
      return;
    }
    const [lo, hi] = rangeOf(type, cycle);
    let text = `${typing.current?.type === type ? typing.current.text : ""}${digit}`;
    if (Number(text) > hi) text = String(digit);
    const n = Number(text);
    if (text.length >= 2 || n * 10 > hi) {
      typing.current = null;
      // "00" on a 1–12 clock is 12.
      update({ ...segments, [type]: n < lo ? hi : n });
      focusSegment(neighbour(type, 1));
    } else {
      typing.current = { type, text };
      update({ ...segments, [type]: n < lo ? null : n });
    }
  };

  const erase = (type: TimeSegmentType, backward: boolean) => {
    typing.current = null;
    if (segments[type] === null) {
      if (backward) focusSegment(neighbour(type, -1));
      return;
    }
    update({ ...segments, [type]: null });
  };

  const onSegmentKeyDown = (type: TimeSegmentType) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const range = rangeOf(type, cycle);
    const set = (n: number) => {
      typing.current = null;
      if (editable) update({ ...segments, [type]: n });
    };
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        set(stepValue(segments[type], event.key === "ArrowUp" ? 1 : -1, range, stride(type)));
        return;
      case "Home":
        event.preventDefault();
        set(range[0]);
        return;
      case "End":
        event.preventDefault();
        set(stepValue(null, -1, range, stride(type)));
        return;
      case "ArrowLeft":
      case "ArrowRight":
        event.preventDefault();
        focusSegment(neighbour(type, event.key === "ArrowRight" ? 1 : -1));
        return;
      case "Backspace":
      case "Delete":
        event.preventDefault();
        if (editable) erase(type, event.key === "Backspace");
        return;
    }
    // Named keys (Tab, Enter, Escape, F-keys) keep their jobs; a character is ours.
    if ([...event.key].length !== 1) return;
    event.preventDefault();
    if (editable) typeText(type, event.key);
  };

  // A touch keyboard sends "Unidentified" keydowns and the text in `beforeinput`.
  // Every edit is ours, so the DOM text is only ever what React renders.
  const onBeforeInput = useRef<(type: TimeSegmentType, event: InputEvent) => void>(() => {});
  onBeforeInput.current = (type, event) => {
    event.preventDefault();
    if (!editable) return;
    if (event.inputType.startsWith("delete")) erase(type, event.inputType.endsWith("Backward"));
    else if (event.data) typeText(type, [...event.data].at(-1) ?? "");
  };
  const orderKey = order.join(" ");
  useEffect(() => {
    const listeners = [...refs.current.entries()].map(([type, element]) => {
      const listener = (event: Event) => onBeforeInput.current(type, event as InputEvent);
      element.addEventListener("beforeinput", listener);
      return () => element.removeEventListener("beforeinput", listener);
    });
    return () => listeners.forEach((off) => off());
  }, [orderKey]);

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault();
    const pasted = parseTimeValue(event.clipboardData.getData("text"));
    if (pasted && editable) {
      typing.current = null;
      update(toSegments(pasted, cycle));
    }
  };

  // Display: each segment in the locale's digits, from a time with the empty ones at zero.
  const shown = segmentTexts(
    {
      hour: isTwelveHour(cycle) ? ((segments.hour ?? 0) % 12) + (segments.dayPeriod ?? 0) * 12 : (segments.hour ?? 0),
      minute: segments.minute ?? 0,
      second: segments.second ?? 0,
    },
    locale,
    cycle,
  );
  const textOf = (type: TimeSegmentType) =>
    segments[type] === null
      ? null
      : type === "dayPeriod"
        ? segments.dayPeriod === 1
          ? layout.pm
          : layout.am
        : shown[type];

  return (
    <div className={cn("grid min-w-0 content-start gap-r5", className)}>
      <div
        {...props}
        id={field.id}
        role="group"
        aria-labelledby={nameIds}
        aria-describedby={field.ariaProps["aria-describedby"]}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        data-readonly={field.readOnly ? "" : undefined}
        className={cn(
          // As wide as its segments, not its column: a time is short.
          "r-form-frame r-dates-time-frame flex h-control min-w-0 max-w-full items-center gap-r4 justify-self-start px-r4",
          classNames?.frame,
        )}
        onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          onMouseDown?.(event);
          // A press on the frame's padding or a separator focuses the first empty segment.
          const target = event.target instanceof Element ? event.target : null;
          if (event.defaultPrevented || disabled || target?.closest('[role="spinbutton"], button, a, input')) return;
          event.preventDefault();
          focusSegment(order.find((type) => segments[type] === null) ?? order[0]);
        }}
        onBlur={(event: FocusEvent<HTMLDivElement>) => {
          onBlur?.(event);
          if (event.currentTarget.contains(event.relatedTarget)) return;
          typing.current = null;
          const filled = order.filter((type) => segments[type] !== null).length;
          setLeftIncomplete(filled > 0 && filled < order.length);
        }}
      >
        <span dir="ltr" className="r-dates-time-segments">
          {layout.parts.map((part, i) => {
            if (part.type === "literal") {
              return (
                <span key={`literal-${i}`} aria-hidden className={cn("r-dates-time-literal", classNames?.literal)}>
                  {part.value}
                </span>
              );
            }
            const type = part.type;
            const text = textOf(type);
            const [lo, hi] = rangeOf(type, cycle);
            const segmentId = `${uid}-${type}`;
            return (
              <span
                key={type}
                ref={(element) => {
                  if (element) refs.current.set(type, element);
                  else refs.current.delete(type);
                }}
                id={segmentId}
                role="spinbutton"
                tabIndex={disabled ? undefined : 0}
                contentEditable={editable || undefined}
                suppressContentEditableWarning
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                inputMode={type === "dayPeriod" ? "text" : "numeric"}
                aria-label={labels[type]}
                aria-labelledby={`${nameIds} ${segmentId}`}
                aria-describedby={field.ariaProps["aria-describedby"]}
                aria-valuemin={lo}
                aria-valuemax={hi}
                aria-valuenow={segments[type] ?? undefined}
                aria-valuetext={text ?? labels.empty}
                aria-invalid={invalid || undefined}
                aria-required={field.required || undefined}
                aria-readonly={field.readOnly || undefined}
                aria-disabled={disabled || undefined}
                data-type={type}
                data-placeholder={text === null ? "" : undefined}
                className={cn("r-dates-segment", classNames?.segment)}
                onKeyDown={onSegmentKeyDown(type)}
                onFocus={() => {
                  typing.current = null;
                }}
                onPaste={onPaste}
              >
                {text ?? labels.placeholder}
              </span>
            );
          })}
        </span>
        {end != null && <span className="flex shrink-0 items-center">{end}</span>}
      </div>
      {nameIds === nameId && (
        <span id={nameId} hidden>
          {ariaLabel ?? labels.label}
        </span>
      )}
      {submitName !== undefined && (
        <input type="hidden" name={submitName} form={form} disabled={disabled} value={committed ?? ""} />
      )}
      <ErrorLine id={errorId} aria-live="polite" icon={error ? undefined : null} className={cn(!error && "sr-only", classNames?.error)}>
        {error}
      </ErrorLine>
    </div>
  );
}
