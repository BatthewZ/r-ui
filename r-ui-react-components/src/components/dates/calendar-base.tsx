"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber } from "../../util/format";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { useField } from "../form";
import { IconButton } from "../primitives";
import {
  addDays,
  addMonths,
  clampDay,
  dayLabel,
  isOutOfBounds,
  isSameDay,
  monthGrid,
  monthLabel,
  monthNumber,
  resolveLocale,
  startOfDay,
  startOfMonth,
  toISODate,
  type Weekday,
  weekdayNames,
  weekStartFor,
} from "./date-core";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";

/** Every string a calendar speaks that `Intl` does not supply. */
export interface CalendarLabels {
  previousMonth: string;
  nextMonth: string;
  /** Appended to today's name. */
  today: string;
  /** Appended to the chosen day's name: the focused day says it, not only its cell. */
  selected: string;
  rangeStart: string;
  rangeEnd: string;
  inRange: string;
}

export const DEFAULT_CALENDAR_LABELS: CalendarLabels = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  today: "today",
  selected: "selected",
  rangeStart: "start of range",
  rangeEnd: "end of range",
  inRange: "in range",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Calendar: CalendarLabels;
  }
}

/** What the selection model says about one day. */
export interface DayState {
  selected?: boolean;
  rangeStart?: boolean;
  rangeEnd?: boolean;
  /** Strictly between the endpoints of a committed range, or of the range being previewed. */
  inRange?: boolean;
}

export type CalendarSlot = "months" | "month" | "caption" | "grid" | "weekday" | "cell" | "day";

/** Props shared by `Calendar` and `RangeCalendar`. */
export interface CalendarCommonProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "children"> {
  /** BCP 47 tag for month and weekday names, day names and week start. Defaults to the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** First column, 0 = Sunday. Defaults to the locale's (from `Intl.Locale` week info). */
  weekStartsOn?: Weekday;
  /**
   * The most months shown side by side. Fewer are shown when the calendar's own
   * width cannot hold them (never the viewport): each month is seven day cells of
   * `--CONTROL-H`, so the count follows density and input too.
   */
  months?: number;
  /** The first month shown (controlled). Any day in it. */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Earliest selectable day (inclusive, by calendar day). */
  min?: Date;
  /** Latest selectable day (inclusive). */
  max?: Date;
  /** Days that can be focused but not chosen (booked, holidays). */
  isDateUnavailable?: (date: Date) => boolean;
  disabled?: boolean;
  /** Move focus to the active day on mount (inside a popup). */
  autoFocus?: boolean;
  labels?: LabelsProp<CalendarLabels>;
  classNames?: SlotClassNames<CalendarSlot>;
}

export interface CalendarBaseProps extends CalendarCommonProps {
  /** Where the view and focus start, and the day the view follows when it changes. */
  anchor: Date | null;
  dayState: (date: Date) => DayState;
  onPick: (date: Date) => void;
  /** The day under the pointer or keyboard focus (range preview), `null` when it leaves. */
  onActiveChange?: (date: Date | null) => void;
  /** Days the selection model refuses, on top of bounds and `isDateUnavailable`. */
  isBlocked?: (date: Date) => boolean;
}

/** Track count of a laid-out grid, or `null` when the value is not a used track list (no layout: jsdom, SSR). */
function usedTracks(grid: HTMLElement): number | null {
  const tracks = getComputedStyle(grid).gridTemplateColumns.replace(/\[[^\]]*\]/g, " ").trim();
  if (tracks === "" || tracks === "none" || tracks.includes("(")) return null;
  return tracks.split(/\s+/).length;
}

const KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

/**
 * The month grid behind `Calendar` and `RangeCalendar`: the WAI-ARIA APG date grid.
 *
 * One tab stop (the active day); arrows move by day and week, Home/End to the
 * week's first and last day, PageUp/PageDown by month, Shift+PageUp/PageDown by
 * year, crossing month boundaries and paging the view as needed. Left and right
 * follow the reading direction. Unavailable days stay focusable and are
 * `aria-disabled`.
 *
 * Several months sit side by side while the calendar's own width holds them: the
 * months are a `repeat(auto-fill, 7 × --CONTROL-H)` grid capped at `months`
 * tracks, and the component renders as many months as the browser laid out
 * tracks for. A breakpoint could not do this: the width a month needs moves
 * with density and input.
 *
 * Inside a `Field` it is named by the Field's label (unless it has its own
 * name) and takes the Field's disabled state.
 */
export function CalendarBase({
  locale: localeProp,
  weekStartsOn,
  months = 1,
  month,
  defaultMonth,
  onMonthChange,
  min,
  max,
  isDateUnavailable,
  disabled: disabledProp,
  autoFocus = false,
  labels: labelsProp,
  classNames,
  className,
  style,
  ref,
  anchor,
  dayState,
  onPick,
  onActiveChange,
  isBlocked,
  onPointerLeave,
  "aria-labelledby": labelledBy,
  ...props
}: CalendarBaseProps) {
  const field = useField();
  const disabled = disabledProp ?? field?.disabled ?? false;
  const labels = useLabels("Calendar", DEFAULT_CALENDAR_LABELS, labelsProp);
  const locale = resolveLocale(useLocale(localeProp));
  const weekStart = weekStartsOn ?? weekStartFor(locale);
  const maxMonths = Math.max(1, Math.floor(months));
  const today = startOfDay(new Date());
  const uid = useId();

  const [shown, setShown] = useControllableState<Date>({
    value: month ? startOfMonth(month) : undefined,
    defaultValue: startOfMonth(defaultMonth ?? anchor ?? clampDay(today, min, max)),
    onChange: onMonthChange,
    isEqual: (a, b) => monthNumber(a) === monthNumber(b),
  });

  // How many months the laid-out grid has room for. All of them until measured
  // (server render, jsdom), then whatever the browser laid out.
  const [fit, setFit] = useState(maxMonths);
  const count = Math.min(fit, maxMonths);
  const monthsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = monthsRef.current;
    if (!grid) return;
    const measure = () => setFit(usedTracks(grid) ?? maxMonths);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [maxMonths]);

  const first = monthNumber(shown);
  const last = first + count - 1;
  const isShown = (d: Date) => monthNumber(d) >= first && monthNumber(d) <= last;

  const unavailable = (d: Date) =>
    isOutOfBounds(d, min, max) || (isDateUnavailable?.(d) ?? false) || (isBlocked?.(d) ?? false);

  const initialFocus = () => {
    if (anchor && isShown(anchor)) return startOfDay(anchor);
    if (isShown(today)) return clampDay(today, min, max);
    return clampDay(shown, min, max);
  };
  const [active, setActive] = useState<Date>(initialFocus);

  // The view follows the anchor when the anchor CHANGES (typed into a field, set
  // by a preset), never on every render: a user who paged away stays there.
  const anchorKey = anchor ? toISODate(anchor) : null;
  const [seenAnchor, setSeenAnchor] = useState(anchorKey);
  if (seenAnchor !== anchorKey) {
    setSeenAnchor(anchorKey);
    if (anchor) {
      setActive(startOfDay(anchor));
      if (!isShown(anchor)) setShown(startOfMonth(anchor));
    }
  }
  // Paged away with the buttons, or the view narrowed: the tab stop follows into view.
  if (!isShown(active) && isShown(initialFocus())) setActive(initialFocus());

  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    rootRef.current?.querySelector<HTMLElement>(`[data-date="${toISODate(active)}"]`)?.focus();
  });

  // A mount-time request, read once.
  const focusOnMount = useRef(autoFocus);
  useEffect(() => {
    if (!focusOnMount.current) return;
    // `preventScroll`: inside a popup this runs before the panel is positioned.
    rootRef.current?.querySelector<HTMLElement>('[data-date][tabindex="0"]')?.focus({ preventScroll: true });
  }, []);

  const moveTo = (target: Date) => {
    const next = clampDay(target, min, max);
    setActive(next);
    pendingFocus.current = true;
    onActiveChange?.(next);
    if (monthNumber(next) < first) setShown(startOfMonth(next));
    else if (monthNumber(next) > last) setShown(addMonths(startOfMonth(next), -(count - 1)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    if (!KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const offset = (active.getDay() - weekStart + 7) % 7;
    const step: Partial<Record<string, number>> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7 };
    const days = step[event.key];
    if (days !== undefined) moveTo(addDays(active, days));
    else if (event.key === "Home") moveTo(addDays(active, -offset));
    else if (event.key === "End") moveTo(addDays(active, 6 - offset));
    else moveTo(addMonths(active, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1)));
  };

  const page = (delta: number) => {
    setShown(addMonths(shown, delta));
    setActive(clampDay(addMonths(active, delta), min, max));
  };
  const atMin = disabled || (min != null && first <= monthNumber(min));
  const atMax = disabled || (max != null && last >= monthNumber(max));

  const visible = Array.from({ length: count }, (_, i) => addMonths(shown, i));
  const names = weekdayNames(locale, weekStart);
  const rangeLabel = visible.map((m) => monthLabel(m, locale)).join(" – ");

  const nav = (direction: -1 | 1) => {
    const Icon = direction < 0 ? ChevronLeft : ChevronRight;
    const blocked = direction < 0 ? atMin : atMax;
    return (
      <IconButton
        label={direction < 0 ? labels.previousMonth : labels.nextMonth}
        icon={<Icon className="rtl:-scale-x-100" />}
        aria-disabled={blocked || undefined}
        onClick={() => page(direction)}
        className={cn("size-control", direction < 0 ? "col-start-1" : "col-start-3")}
      />
    );
  };

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      role="group"
      aria-labelledby={labelledBy ?? (props["aria-label"] ? undefined : field?.labelId)}
      data-disabled={disabled ? "" : undefined}
      className={cn("r-dates-calendar", disabled && "opacity-disabled", className)}
      style={{ "--r-dates-months": maxMonths, ...style } as CSSProperties}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        onActiveChange?.(null);
      }}
      {...props}
    >
      {/* The month changes without focus moving (the buttons keep it), so the new
          view is announced. Mounted from the start: a live region created with its
          first text is not reliably read. */}
      <div aria-live="polite" className="sr-only">
        {rangeLabel}
      </div>
      <div ref={monthsRef} className={cn("r-dates-months", classNames?.months)}>
        {visible.map((m, index) => {
          const captionId = `${uid}-${index}`;
          return (
            // Keyed by position, not by month: paging keeps the month buttons (and
            // the focus on them) rather than remounting them with a new month.
            <div key={index} className={cn("r-dates-month", classNames?.month)}>
              <div className={cn("r-dates-caption", classNames?.caption)}>
                {index === 0 && nav(-1)}
                <div id={captionId} className="col-start-2 truncate text-center text-body-1 font-semibold text-fg-primary">
                  {monthLabel(m, locale)}
                </div>
                {index === count - 1 && nav(1)}
              </div>
              <table
                role="grid"
                aria-labelledby={captionId}
                className={cn("r-dates-grid", classNames?.grid)}
                onKeyDown={onKeyDown}
              >
                <thead>
                  <tr>
                    {names.map((name) => (
                      <th
                        key={name.long}
                        scope="col"
                        abbr={name.long}
                        aria-label={name.long}
                        className={cn("text-body-3 font-medium text-fg-muted", classNames?.weekday)}
                      >
                        {name.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthGrid(m, weekStart).map((week, row) => (
                    <tr key={row}>
                      {week.map((day, col) =>
                        day ? (
                          <DayCell
                            key={col}
                            day={day}
                            state={dayState(day)}
                            today={isSameDay(day, today)}
                            unavailable={unavailable(day)}
                            disabled={disabled}
                            active={isSameDay(day, active)}
                            locale={locale}
                            labels={labels}
                            classNames={classNames}
                            onPick={(d) => {
                              setActive(d);
                              onPick(d);
                            }}
                            onHover={onActiveChange}
                          />
                        ) : (
                          <td key={col} role="gridcell" className={cn("r-dates-cell", classNames?.cell)} />
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  day,
  state,
  today,
  unavailable,
  disabled,
  active,
  locale,
  labels,
  classNames,
  onPick,
  onHover,
}: {
  day: Date;
  state: DayState;
  today: boolean;
  /** Ruled out for this day (bounds, the caller, the range model): struck through. */
  unavailable: boolean;
  /** The whole calendar is disabled: it fades as one, nothing is struck. */
  disabled: boolean;
  active: boolean;
  locale: string;
  labels: CalendarLabels;
  classNames?: SlotClassNames<CalendarSlot>;
  onPick: (d: Date) => void;
  onHover?: (d: Date | null) => void;
}) {
  const endpoint = Boolean(state.selected || state.rangeStart || state.rangeEnd);
  // The band joins the endpoints: half a cell at each end, whole cells between.
  // A one-day range has no band.
  const band =
    state.rangeStart && state.rangeEnd
      ? undefined
      : state.rangeStart
        ? "start"
        : state.rangeEnd
          ? "end"
          : state.inRange
            ? "mid"
            : undefined;
  // Focus is on the day's button, which `aria-selected` on its cell does not
  // reach; range membership has no ARIA state of its own; a tint is not a name.
  const suffix = [
    today && labels.today,
    state.selected && labels.selected,
    state.rangeStart && labels.rangeStart,
    state.rangeEnd && labels.rangeEnd,
    state.inRange && labels.inRange,
  ].filter(Boolean);
  return (
    <td
      role="gridcell"
      aria-selected={endpoint || state.inRange ? true : undefined}
      data-band={band}
      className={cn("r-dates-cell", band && "before:bg-selection", classNames?.cell)}
    >
      <button
        type="button"
        data-date={toISODate(day)}
        tabIndex={active ? 0 : -1}
        aria-label={[dayLabel(day, locale), ...suffix].join(", ")}
        aria-current={today ? "date" : undefined}
        aria-disabled={unavailable || disabled || undefined}
        data-today={today ? "" : undefined}
        data-selected={endpoint ? "" : undefined}
        className={cn(
          "r-dates-day text-body-1",
          endpoint
            ? "bg-accent font-semibold text-fg-on-accent hover:bg-accent-hover"
            : state.inRange
              ? "text-fg-on-selection forced-colors:forced-color-adjust-none"
              : today
                ? "font-semibold text-fg-accent"
                : "text-fg-primary",
          !endpoint && !unavailable && !disabled && "hover:bg-fg-primary/8",
          unavailable && !disabled && "text-fg-muted line-through",
          classNames?.day,
        )}
        onClick={() => {
          if (!unavailable && !disabled) onPick(day);
        }}
        onPointerEnter={onHover && !unavailable && !disabled ? () => onHover(day) : undefined}
      >
        {/* The locale's own digits (Arabic-Indic in `ar-EG`). */}
        {formatNumber(day.getDate(), { locale, useGrouping: false })}
      </button>
    </td>
  );
}
