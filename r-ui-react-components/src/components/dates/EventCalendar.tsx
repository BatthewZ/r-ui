"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ComponentPropsWithRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { SegmentedControl } from "../form";
import { Button, IconButton } from "../primitives";
import { addDays, dateFormatter, isSameDay, monthLabel, resolveLocale, startOfDay, type Weekday, weekStartFor } from "./date-core";
import { EventAgenda } from "./EventAgenda";
import {
  type CalendarEvent,
  EVENT_CALENDAR_VIEWS,
  type EventCalendarView,
  type Period,
  periodOf,
  placeEvents,
  stepDate,
} from "./event-core";
import { DEFAULT_EVENT_CALENDAR_LABELS, type EventCalendarLabels, type EventCalendarSlot, type EventViewProps } from "./event-parts";
import { EventMonthView } from "./EventMonthView";
import { EventTimeGrid } from "./EventTimeGrid";

export interface EventCalendarProps extends Omit<ComponentPropsWithRef<"div">, "children" | "onChange" | "defaultValue"> {
  /** The events to show. Read-only: the calendar never changes them. */
  events: readonly CalendarEvent[];
  /** The view shown (controlled). */
  view?: EventCalendarView;
  /** @default "month" */
  defaultView?: EventCalendarView;
  onViewChange?: (view: EventCalendarView) => void;
  /** The views the switch offers, in its order. One view: no switch. @default every view */
  views?: readonly EventCalendarView[];
  /**
   * The active day (controlled; a calendar date, local midnight): the views'
   * tab stop, and the day whose month, week or day is shown. Moving through the
   * days by keyboard changes it, so a URL can follow it.
   */
  date?: Date;
  /** Omitted: today. */
  defaultDate?: Date;
  onDateChange?: (date: Date) => void;
  /**
   * An event was pressed. With it, events without an `href` are buttons;
   * without it, they are text (a linked event is a link either way, and this
   * runs before it navigates).
   */
  onEventClick?: (event: CalendarEvent) => void;
  /** BCP 47 tag for every name, date and time. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** First day of the week, 0 = Sunday. Defaults to the locale's. */
  weekStartsOn?: Weekday;
  /** The clock: today, and the time grid's now line. Omitted: the runtime's, ticking each minute. */
  now?: Date | number;
  /** Month view: the events a day shows before "+n more" (that row included). @default 3 */
  maxEventsPerDay?: number;
  /** Week and day views: the hour scrolled to the top when the grid mounts. @default 8 */
  scrollToHour?: number;
  /** Events are loading: the body is busy and says so. */
  loading?: boolean;
  labels?: LabelsProp<EventCalendarLabels>;
  classNames?: SlotClassNames<EventCalendarSlot>;
}

/** Ticks each minute while no `now` is given. */
function useNow(fixed: Date | number | undefined): number {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (fixed !== undefined) return;
    const id = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fixed]);
  return fixed === undefined ? clock : fixed instanceof Date ? fixed.getTime() : fixed;
}

/** "October 2026", "Oct 12 – 18, 2026", "Thursday, October 15, 2026". */
function periodTitle(view: EventCalendarView, date: Date, period: Period, locale: string): string {
  if (view === "week") {
    return dateFormatter(locale, { month: "short", day: "numeric", year: "numeric" }).formatRange(
      period.start,
      addDays(period.end, -1),
    );
  }
  if (view === "day") {
    return dateFormatter(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
  }
  return monthLabel(date, locale);
}

/**
 * Events on a calendar: a month grid, a week or a day as a time grid, or an
 * agenda list, with a toolbar to page through periods, return to today and
 * switch views. Read-only: an event is a link (`href`), a button
 * (`onEventClick`) or text.
 *
 * Instants are shown in local time; a `YYYY-MM-DD` event is an all-day calendar
 * date. Each event's name says its title, when, category, status and location,
 * so a short chip or block never hides anything from a screen reader; the
 * entity's colour (`slot`) is a mark beside it, never under text.
 *
 * `view` and `date` are controllable, so a URL can hold them. The period title is
 * announced when it changes. Density, input, direction and the calendar's own
 * width (never the viewport) shape every view.
 */
export function EventCalendar({
  events,
  view: viewProp,
  defaultView = "month",
  onViewChange,
  views = EVENT_CALENDAR_VIEWS,
  date: dateProp,
  defaultDate,
  onDateChange,
  onEventClick,
  locale: localeProp,
  weekStartsOn,
  now: nowProp,
  maxEventsPerDay = 3,
  scrollToHour = 8,
  loading = false,
  labels: labelsProp,
  classNames,
  className,
  ...props
}: EventCalendarProps) {
  const labels = useLabels("EventCalendar", DEFAULT_EVENT_CALENDAR_LABELS, labelsProp);
  const locale = resolveLocale(useLocale(localeProp));
  const weekStart = weekStartsOn ?? weekStartFor(locale);
  const now = useNow(nowProp);
  const today = startOfDay(new Date(now));

  const [view, setView] = useControllableState<EventCalendarView>({
    value: viewProp,
    defaultValue: defaultView,
    onChange: onViewChange,
  });
  const [date, setDate] = useControllableState<Date>({
    value: dateProp ? startOfDay(dateProp) : undefined,
    defaultValue: startOfDay(defaultDate ?? today),
    onChange: onDateChange,
    isEqual: isSameDay,
  });

  const placed = useMemo(() => placeEvents(events), [events]);

  // "Open day" unmounts the view that held focus, which drops it to <body>: the
  // day view's first tab stop takes it. Focus that landed anywhere else stays.
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusDayView = useRef(false);
  useLayoutEffect(() => {
    if (!focusDayView.current) return;
    focusDayView.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    bodyRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  });
  const period = periodOf(view, date, weekStart);
  const title = periodTitle(view, date, period, locale);

  const shared: EventViewProps = {
    placed,
    date,
    onDateChange: (day) => setDate(startOfDay(day)),
    period,
    title,
    weekStart,
    locale,
    now,
    labels,
    onEventClick,
    onOpenDay: views.includes("day")
      ? (day) => {
          focusDayView.current = true;
          setDate(startOfDay(day));
          setView("day");
        }
      : undefined,
    classNames,
  };

  return (
    <div
      role="group"
      aria-label={props["aria-labelledby"] ? undefined : labels.region}
      {...props}
      // `minmax(0, 1fr)`: an `auto` column would grow to the toolbar's min-content
      // (the view switch) and push every view past a narrow calendar.
      className={cn("r-dates-event-calendar grid min-w-0 grid-cols-[minmax(0,1fr)] gap-r4", className)}
    >
      <div className={cn("r-dates-event-toolbar", classNames?.toolbar)}>
        <div className="flex items-center gap-r5">
          <Button variant="secondary" onClick={() => setDate(today)}>
            {labels.today}
          </Button>
          <IconButton
            label={labels.previous[view]}
            icon={<ChevronLeft className="rtl:-scale-x-100" />}
            onClick={() => setDate(stepDate(view, date, -1))}
            className="size-control"
          />
          <IconButton
            label={labels.next[view]}
            icon={<ChevronRight className="rtl:-scale-x-100" />}
            onClick={() => setDate(stepDate(view, date, 1))}
            className="size-control"
          />
        </div>
        {/* Announced when the period changes; mounted from the start, as a live
            region created with its first text is not reliably read. */}
        <div
          aria-live="polite"
          className={cn("min-w-0 grow break-words text-h4 font-semibold text-fg-primary", classNames?.title)}
        >
          {title}
        </div>
        {views.length > 1 && (
          <SegmentedControl
            aria-label={labels.viewSwitch}
            value={view}
            onValueChange={(next) => setView(next as EventCalendarView)}
            className={classNames?.views}
          >
            {views.map((v) => (
              <SegmentedControl.Item key={v} value={v}>
                {labels.views[v]}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        )}
      </div>
      <div
        ref={bodyRef}
        aria-busy={loading || undefined}
        className={cn("min-w-0", loading && "opacity-disabled", classNames?.body)}
      >
        <div role="status" className="sr-only">
          {loading ? labels.loading : ""}
        </div>
        {view === "month" ? (
          <EventMonthView {...shared} maxEventsPerDay={Math.max(1, Math.floor(maxEventsPerDay))} />
        ) : view === "agenda" ? (
          <EventAgenda {...shared} loading={loading} />
        ) : (
          <EventTimeGrid {...shared} scrollToHour={Math.min(23, Math.max(0, Math.floor(scrollToHour)))} />
        )}
      </div>
    </div>
  );
}
