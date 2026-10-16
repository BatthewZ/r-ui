"use client";
import { Check, Clock } from "lucide-react";
import { type KeyboardEvent, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { useFieldValue } from "../form";
import { Popover } from "../overlays";
import { IconButton } from "../primitives";
import { resolveLocale } from "./date-core";
import { DEFAULT_TIME_FIELD_LABELS, TimeField, type TimeFieldLabels, type TimeFieldProps } from "./TimeField";
import {
  clockHour,
  formatTimeLabel,
  formatTimeValue,
  type HourCycle,
  hourCycleFor,
  parseTimeValue,
  type TimeParts,
  timeOf,
  timeSlots,
  timeToSeconds,
} from "./time-core";

export interface TimePickerLabels extends TimeFieldLabels {
  /** The list button's name, and the popup's. */
  chooseTime: string;
}

export const DEFAULT_TIME_PICKER_LABELS: TimePickerLabels = {
  ...DEFAULT_TIME_FIELD_LABELS,
  chooseTime: "Choose time",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    TimePicker: TimePickerLabels;
  }
}

export interface TimePickerProps extends Omit<TimeFieldProps, "end" | "labels" | "classNames"> {
  /** The list's stride in minutes, and the minutes segment's arrows. @default 30 */
  step?: number;
  /** The list popup (controlled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: LabelsProp<TimePickerLabels>;
  /** `className` styles the root; `ref` and the rest address the field's frame. */
  classNames?: TimeFieldProps["classNames"] & SlotClassNames<"trigger" | "panel" | "list" | "option">;
}

/** An option's id: from its time, so it never follows a position. */
const optionKey = (t: TimeParts) => formatTimeValue(t, true).replaceAll(":", "");

/** The option nearest `t` around the clock (a value off the stride, or now). */
function nearest(slots: TimeParts[], t: TimeParts): number {
  const n = timeToSeconds(t);
  let best = 0;
  let bestDistance = Infinity;
  slots.forEach((slot, i) => {
    const d = Math.abs(timeToSeconds(slot) - n);
    const distance = Math.min(d, 86_400 - d);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * The option typed digits name: "9" or "13" an hour (its first option), "930"
 * or "1330" an hour and the start of its minutes; on a 12-hour clock "13" is
 * 1:30. Hours are the clock's own (9 is the first 9 o'clock in the list).
 */
function typedOption(options: { t: TimeParts }[], text: string, cycle: HourCycle): number {
  const tries: [number, string][] = [];
  if (text.length <= 2) tries.push([Number(text), ""]);
  if (text.length >= 2) tries.push([Number(text.slice(0, 1)), text.slice(1)]);
  if (text.length >= 3) tries.push([Number(text.slice(0, 2)), text.slice(2)]);
  for (const [hour, minutes] of tries) {
    const i = options.findIndex(({ t }) => clockHour(t.hour, cycle) === hour && String(t.minute).padStart(2, "0").startsWith(minutes));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * A `TimeField` with a list of times beside it: the button at the field's end
 * opens a popup listing `min` to `max` (default the whole day) every `step`
 * minutes, in the locale's clock.
 *
 * - The list is a `listbox` that takes focus on open, with the chosen time (else
 *   the one nearest it, else the one nearest now) active and scrolled to the
 *   middle. Up / Down / Home / End / PageUp / PageDown move, typing digits jumps
 *   ("9" to 9:00, "13" to 13:00), Enter or Space chooses and closes; Escape or a
 *   press outside closes; focus returns to the button. Option ids come from the
 *   times. `open` is controllable.
 * - The popup is in place + top layer (compact in a compact card, never clipped).
 * - Typing in the field stays exact: a time off the list's stride is a value too.
 * - Everything else is `TimeField`'s: the value (`HH:mm`, 24-hour), `Field`
 *   binding, `min` / `max` refusals, `name` submission.
 */
export function TimePicker({
  value,
  defaultValue = null,
  onValueChange,
  step = 30,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelsProp,
  classNames,
  locale: localeProp,
  hourCycle,
  withSeconds = false,
  min,
  max,
  disabled,
  readOnly,
  ...props
}: TimePickerProps) {
  const labels = useLabels("TimePicker", DEFAULT_TIME_PICKER_LABELS, labelsProp);
  const locale = resolveLocale(useLocale(localeProp));
  const cycle = hourCycleFor(locale, hourCycle);
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  // The picker owns the value so the list can show it; TimeField renders the
  // hidden input (it takes the Field's name too) and the Field wiring.
  const [time, setTime] = useFieldValue<string | null>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "string" && parseTimeValue(raw) ? raw : null),
  });
  const { trigger: triggerClass, panel: panelClass, list: listClass, option: optionClass, ...fieldClassNames } = classNames ?? {};

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
      <TimeField
        {...props}
        value={time}
        onValueChange={setTime}
        locale={locale}
        hourCycle={hourCycle}
        withSeconds={withSeconds}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        readOnly={readOnly}
        labels={labels}
        classNames={fieldClassNames}
        end={
          <Popover.Trigger asChild>
            <IconButton
              // Paper shows the value, not the list behind it.
              data-print="hide"
              label={labels.chooseTime}
              icon={<Clock />}
              disabled={disabled || readOnly}
              className={triggerClass}
            />
          </Popover.Trigger>
        }
      />
      <TimeList
        value={time}
        onChoose={(t) => {
          setTime(formatTimeValue(t, withSeconds));
          setOpen(false);
        }}
        step={step}
        min={min}
        max={max}
        locale={locale}
        cycle={cycle}
        label={labels.chooseTime}
        open={open}
        classNames={{ panel: panelClass, list: listClass, option: optionClass }}
      />
    </Popover>
  );
}

function TimeList({
  value,
  onChoose,
  step,
  min,
  max,
  locale,
  cycle,
  label,
  open,
  classNames,
}: {
  value: string | null;
  onChoose: (t: TimeParts) => void;
  step: number;
  min?: string;
  max?: string;
  locale: string;
  cycle: HourCycle;
  label: string;
  open: boolean;
  classNames: { panel?: string; list?: string; option?: string };
}) {
  const slots = useMemo(() => timeSlots(step, parseTimeValue(min), parseTimeValue(max)), [step, min, max]);
  const options = useMemo(
    () => slots.map((t) => ({ t, key: optionKey(t), text: formatTimeLabel(t, locale, cycle) })),
    [slots, locale, cycle],
  );
  const chosen = parseTimeValue(value);
  const selectedKey = chosen ? optionKey(chosen) : undefined;
  const startIndex = () => nearest(slots, chosen ?? timeOf(new Date()));

  const [active, setActive] = useState(startIndex);
  const [pointer, setPointer] = useState(false);
  // Every opening starts at the chosen time (a parent's `open` included).
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) {
      setActive(startIndex());
      setPointer(false);
    }
  }
  const index = Math.min(active, options.length - 1);

  const uid = useId();
  const optionId = (key: string) => `${uid}-t${key}`;
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  /** Brings the active option into view: to the middle, or only as far as it takes. */
  const reveal = (centre: boolean) => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (centre) list.scrollTop = top - (list.clientHeight - option.offsetHeight) / 2;
    else if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  };
  // On open, the active option in the middle of the list; after that, the
  // keyboard's option kept in view, only when it moves (a re-render while the
  // user scrolls must not pull the list back) and never for the pointer.
  const opening = useRef(true);
  useLayoutEffect(() => {
    if (!open) {
      opening.current = true;
      return;
    }
    if (pointer) return;
    if (!opening.current) {
      reveal(false);
      return;
    }
    opening.current = false;
    reveal(true);
  }, [open, index, pointer]);

  const move = (next: number) => {
    setPointer(false);
    setActive(Math.max(0, Math.min(options.length - 1, next)));
  };
  const page = () => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>("[role=option]")?.offsetHeight ?? 0;
    return list && row > 0 ? Math.max(1, Math.floor(list.clientHeight / row) - 1) : 8;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(index + 1),
      ArrowUp: () => move(index - 1),
      Home: () => move(0),
      End: () => move(options.length - 1),
      PageDown: () => move(index + page()),
      PageUp: () => move(index - page()),
      Enter: () => options[index] && onChoose(options[index].t),
      " ": () => options[index] && onChoose(options[index].t),
    };
    const run = keys[event.key];
    if (run) {
      event.preventDefault();
      run();
      return;
    }
    // Typeahead by digits ("9" → 9:00, "13" → 13:00), one run while presses come quickly.
    if (!/^[0-9]$/.test(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const now = event.timeStamp;
    const text = (now - typed.current.at < 700 ? typed.current.text : "") + event.key;
    typed.current = { text, at: now };
    const match = typedOption(options, text, cycle);
    if (match >= 0) move(match);
  };

  const activeKey = options[index]?.key;
  return (
    <Popover.Content
      aria-label={label}
      initialFocus={listRef}
      className={cn("w-max p-r6", classNames.panel)}
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          // `relative`: the options' offsetParent, so the scroll maths read the list's own offsets.
          "r-dates-time-list relative max-h-[calc(var(--ROW-H)*8)] overflow-y-auto overscroll-contain",
          classNames.list,
        )}
      >
        {options.map((option, i) => {
          const selected = option.key === selectedKey;
          return (
            <div
              key={option.key}
              id={optionId(option.key)}
              role="option"
              aria-selected={selected}
              data-index={i}
              data-active={i === index ? (pointer ? "pointer" : "keyboard") : undefined}
              onPointerMove={() => {
                if (i !== index || !pointer) {
                  setPointer(true);
                  setActive(i);
                }
              }}
              onClick={() => onChoose(option.t)}
              className={cn(
                "r-form-option flex min-h-row w-full cursor-default select-none items-center gap-r4 rounded-sm px-r4 py-r6 text-start",
                "data-[active]:bg-fg-primary/8 forced-colors:data-[active]:bg-selection forced-colors:aria-selected:bg-selection",
                classNames.option,
              )}
            >
              <span className="min-w-0 flex-1 whitespace-nowrap">{option.text}</span>
              <Check
                aria-hidden
                className={cn("r-form-option-check size-icon shrink-0 text-fg-accent", !selected && "invisible")}
              />
            </div>
          );
        })}
      </div>
    </Popover.Content>
  );
}
