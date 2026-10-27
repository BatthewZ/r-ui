"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { SegmentedControl } from "../form";
import type { PopoverAnchor } from "../overlays";
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
import { type CalendarEventChange, type CalendarRange, sameRange, type SlotMinutes } from "./event-edit";
import { DEFAULT_EVENT_CALENDAR_LABELS, type EventCalendarLabels, type EventCalendarSlot, type EventViewProps } from "./event-parts";
import { EventMonthView } from "./EventMonthView";
import { EventTimeGrid } from "./EventTimeGrid";

/** What `renderSelection` is given while a picked range is on screen. */
export interface EventCalendarSelection {
  range: CalendarRange;
  /**
   * Where the range is drawn: its last piece (the end of the range), measured
   * each time it is read, so a panel beside it follows scrolling. Give it to a
   * `Popover`'s `anchor`, or ignore it for a drawer or a dialog.
   */
  anchor: PopoverAnchor;
  /** Clears the pick (`onSelectionChange(null)`), as Escape does: for a Cancel, or a panel closing. */
  clear: () => void;
}

export interface EventCalendarProps extends Omit<ComponentPropsWithRef<"div">, "children" | "onChange" | "defaultValue"> {
  /** The events to show. The calendar never changes them: it reports picks and changes. */
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
  /**
   * The picked range (controlled), drawn until it is cleared: keep a range on
   * screen while your own form for it is open, then set `null`.
   */
  selection?: CalendarRange | null;
  defaultSelection?: CalendarRange | null;
  /**
   * A range was picked, or cleared (`null`: Escape, or opening or moving an
   * event, which abandons a pick). With it the calendar takes picking: a drag
   * or a press on the time grid's slots, a drag across the month's days, the
   * keyboard's slot cursor (Shift with arrows, then Enter), and the day
   * panel's "New event". A new press replaces the picked range on screen from
   * the moment it lands. The calendar adds nothing: open your own form for
   * the range.
   */
  onSelectionChange?: (range: CalendarRange | null) => void;
  /**
   * An event was moved or resized, with where it would go, in `CalendarEvent`'s
   * own terms. With it, events can be dragged (and their end resized) and, in
   * the week and day views, picked up by the keyboard (Space); an event with
   * `editable: false` stays put. The calendar never changes `events`: update
   * them, or leave them to refuse the change.
   */
  onEventChange?: (change: CalendarEventChange) => void;
  /** The time grid's slot, and the snap for picking, moving and resizing, in minutes. @default 30 */
  slotMinutes?: SlotMinutes;
  /**
   * Your own surface for the picked range, whatever it is: a `Popover` at
   * `anchor`, a `Drawer`, a `Dialog`, an inline form. Rendered inside the
   * calendar (so it takes its density) while the picked range is drawn on
   * screen, and not while a new one is being picked or when the range is off
   * the period shown. The calendar renders nothing of its own here.
   */
  renderSelection?: (selection: EventCalendarSelection) => ReactNode;
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
 * switch views. An event is a link (`href`), a button (`onEventClick`) or
 * text. With `onSelectionChange` a range can be picked, and with
 * `onEventChange` events can be moved and resized; the calendar only reports
 * them, and the app changes `events`.
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
  selection: selectionProp,
  defaultSelection = null,
  onSelectionChange,
  onEventChange,
  slotMinutes = 30,
  renderSelection,
  labels: labelsProp,
  classNames,
  className,
  ref,
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

  const [selection, setSelection] = useControllableState<CalendarRange | null>({
    value: selectionProp,
    defaultValue: defaultSelection,
    onChange: onSelectionChange,
    isEqual: sameRange,
  });

  // What the views announce, said in the body's status region. The same
  // message twice in a row is cleared first, so it is read again.
  const [message, setMessage] = useState("");
  const announce = useCallback((next: string) => {
    setMessage((was) => {
      if (was !== next) return next;
      queueMicrotask(() => setMessage(next));
      return "";
    });
  }, []);

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

  // Where the picked range is drawn now: its last piece, or none (not drawn here,
  // or giving way to a pick under way). Watched in the DOM, as a view redraws it
  // without the calendar rendering. Only for `renderSelection`.
  const rootRef = useRef<HTMLDivElement>(null);
  const [pickedPiece, setPickedPiece] = useState<Element | null>(null);
  const watchPick = Boolean(renderSelection);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!watchPick || !root) return setPickedPiece(null);
    const find = () => {
      const pieces = root.querySelectorAll("[data-selection-piece]");
      const last = pieces.item(pieces.length - 1);
      setPickedPiece((was) => (was === last ? was : last));
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-selection-piece"] });
    return () => observer.disconnect();
  }, [watchPick]);
  const anchor = useMemo<PopoverAnchor | null>(
    () => (pickedPiece ? { getBoundingClientRect: () => pickedPiece.getBoundingClientRect(), contextElement: pickedPiece } : null),
    [pickedPiece],
  );

  // A pick is a half-made "add": turning to an event (opening it, moving it) abandons it.
  const dropPick = () => {
    if (onSelectionChange && selection) setSelection(null);
  };

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
    onEventClick: onEventClick
      ? (event) => {
          dropPick();
          onEventClick(event);
        }
      : undefined,
    onOpenDay: views.includes("day")
      ? (day) => {
          focusDayView.current = true;
          setDate(startOfDay(day));
          setView("day");
        }
      : undefined,
    classNames,
    slotMinutes,
    selection,
    onSelectionChange: onSelectionChange ? setSelection : undefined,
    onEventChange: onEventChange
      ? (change) => {
          dropPick();
          onEventChange(change);
        }
      : undefined,
    announce,
  };

  return (
    <div
      role="group"
      aria-label={props["aria-labelledby"] ? undefined : labels.region}
      {...props}
      ref={mergeRefs(ref, rootRef)}
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
        {/* The calendar's one status region: loading, else what the views announce. */}
        <div role="status" data-calendar-announcer="" className="sr-only">
          {loading ? labels.loading : message}
        </div>
        {view === "month" ? (
          <EventMonthView {...shared} maxEventsPerDay={Math.max(1, Math.floor(maxEventsPerDay))} />
        ) : view === "agenda" ? (
          <EventAgenda {...shared} loading={loading} />
        ) : (
          <EventTimeGrid {...shared} scrollToHour={Math.min(23, Math.max(0, Math.floor(scrollToHour)))} />
        )}
      </div>
      {renderSelection && selection && anchor && renderSelection({ range: selection, anchor, clear: () => setSelection(null) })}
    </div>
  );
}
