"use client";
import { useControllableState } from "../../hooks/use-controllable-state";
import { CalendarBase, type CalendarCommonProps } from "./calendar-base";
import { isSameDay, startOfDay } from "./date-core";

export interface CalendarProps extends CalendarCommonProps {
  /** The chosen day (a calendar date: local midnight; a time of day is ignored). */
  value?: Date | null;
  defaultValue?: Date | null;
  /**
   * The chosen day, at local midnight (a press never clears it). Typed as the
   * value is, so one `Date | null` handler serves the Calendar and the pickers.
   */
  onValueChange?: (date: Date | null) => void;
}

/**
 * A month grid for choosing one day (WAI-ARIA APG date grid). Month, weekday and
 * day names, digits and the first day of the week come from `Intl` for `locale`.
 *
 * States: today (`aria-current="date"`, accent ink and a dot), selected (accent
 * fill, semibold: a shape and weight cue, not colour alone), unavailable
 * (`aria-disabled`, muted and struck through; focusable but not chosen),
 * disabled. Inside a `Field` it is named by the Field's label.
 */
export function Calendar({ value, defaultValue = null, onValueChange, ...props }: CalendarProps) {
  const [selected, setSelected] = useControllableState<Date | null>({
    value,
    defaultValue,
    isEqual: isSameDay,
  });
  return (
    <CalendarBase
      {...props}
      anchor={selected}
      dayState={(day) => ({ selected: isSameDay(day, selected) })}
      onPick={(day) => {
        setSelected(day);
        onValueChange?.(startOfDay(day));
      }}
    />
  );
}
