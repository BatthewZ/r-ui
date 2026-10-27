"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
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
import { composeEventHandlers } from "../../util/merge-props";
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
import {
  DEFAULT_EVENT_CALENDAR_LABELS,
  EventDeleteContext,
  type EventCalendarLabels,
  type EventCalendarSlot,
  type EventViewProps,
  isDeletableEvent,
} from "./event-parts";
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

/** What `renderEventDetails` is given while an event is open. */
export interface EventCalendarEventDetails<T extends CalendarEvent = CalendarEvent> {
  /** The open event: the very object in `events` (your own type, every field of it), as it is now. */
  event: T;
  /**
   * Where it was opened: the chip, block, bar or row that was pressed, measured
   * each time it is read (another drawing of the same event if that one is
   * gone), so a panel beside it follows scrolling. For a `Popover`'s `anchor`.
   */
  anchor: PopoverAnchor;
  /** Closes the details: for a Close button, or a panel closing. */
  close: () => void;
}

/**
 * `T`: your own event type. Give it every field you keep (attachments, a
 * booking's id, an owner); the calendar reads only `CalendarEvent`'s, keeps
 * your objects as they are, and hands them back typed as `T`.
 */
export interface EventCalendarProps<T extends CalendarEvent = CalendarEvent>
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onChange" | "defaultValue"> {
  /** The events to show. The calendar never changes them: it reports picks and changes. */
  events: readonly T[];
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
   * An event was pressed (or Enter on it): your own object. With it (or
   * `renderEventDetails`), events without an `href` are buttons; without
   * either, they are text (a linked event is a link either way, and this runs
   * before it navigates).
   */
  onEventClick?: (event: T) => void;
  /**
   * Your own surface for an opened event, whatever it holds (a description,
   * pictures, attachments, links elsewhere) and whatever it is (a `Popover` at
   * `anchor`, a `Drawer`, a `Dialog`). Rendered inside the calendar while the
   * event is open: until `close`, another event is opened, the event leaves
   * `events`, or the view or the period changes. A chip or block shows only the
   * event's short form; the full detail belongs here.
   */
  renderEventDetails?: (details: EventCalendarEventDetails<T>) => ReactNode;
  /**
   * Delete or Backspace on a focused event (the week and day views, the agenda,
   * the month's day panel): your own object. The calendar removes nothing and
   * says nothing: delete it (and say so, offer an undo), confirm first, or
   * refuse. Not while an event is picked up to move, with a modifier held, or
   * held down; never for an event with `editable: false`. When the event leaves
   * `events`, focus moves to the next event. With it, events are buttons on
   * their own and say the key (`aria-keyshortcuts`).
   */
  onEventDelete?: (event: T) => void;
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
  onEventChange?: (change: CalendarEventChange<T>) => void;
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
export function EventCalendar<T extends CalendarEvent = CalendarEvent>({
  events,
  view: viewProp,
  defaultView = "month",
  onViewChange,
  views = EVENT_CALENDAR_VIEWS,
  date: dateProp,
  defaultDate,
  onDateChange,
  onEventClick,
  renderEventDetails,
  onEventDelete,
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
}: EventCalendarProps<T>) {
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

  // The event whose details are open (`renderEventDetails`), by its key, and the element it
  // was opened from. Closed when the view or the period changes: what it sat beside is gone.
  const [opened, setOpened] = useState<{ key: string; target: HTMLElement } | null>(null);
  const periodKey = `${view}:${period.start.getTime()}`;
  const [openedIn, setOpenedIn] = useState(periodKey);
  if (openedIn !== periodKey) {
    setOpenedIn(periodKey);
    if (opened) setOpened(null);
  }
  const openEvent = opened ? placed.find((p) => p.key === opened.key)?.event : undefined;
  const detailsAnchor = useMemo<PopoverAnchor | null>(() => {
    if (!opened) return null;
    let last = opened.target.getBoundingClientRect();
    // Drawn: on screen with a box (a narrow month keeps its chips in the DOM, undisplayed).
    const drawn = (el: HTMLElement) => {
      const r = el.isConnected ? el.getBoundingClientRect() : null;
      return r && (r.width > 0 || r.height > 0) ? r : null;
    };
    return {
      // The opened element while it is drawn, else another drawing of the event, else where it last was.
      getBoundingClientRect: () => {
        const others = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-event]") ?? [])].filter((e) => e.dataset.event === opened.key);
        for (const el of [opened.target, ...others]) {
          const r = drawn(el);
          if (r) return (last = r);
        }
        return last;
      },
      contextElement: opened.target,
    };
  }, [opened]);

  // Delete or Backspace on a focused event. Where focus goes when the app takes the event
  // away: the event now where the deleted one was among those the keys reach, read once
  // the event has left `events` and only if focus fell to the page with it.
  const deleted = useRef<{ key: string; index: number } | null>(null);
  const keyReached = () =>
    [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-event]") ?? [])].filter(
      (el) => el.matches("a[href], button") && el.tabIndex >= 0,
    );
  const onDeleteKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onEventDelete || (event.key !== "Delete" && event.key !== "Backspace")) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    // The event itself has focus (not a field in a surface the app rendered), and it is not
    // picked up to move.
    if (!target.matches("[data-event]") || target.hasAttribute("data-moving")) return;
    const p = placed.find((x) => x.key === target.dataset.event);
    if (!p || !isDeletableEvent(p, true)) return;
    event.preventDefault();
    deleted.current = { key: p.key, index: Math.max(0, keyReached().indexOf(target)) };
    dropPick();
    onEventDelete(p.event as T);
  };
  useLayoutEffect(() => {
    const was = deleted.current;
    if (!was || placed.some((p) => p.key === was.key)) return;
    deleted.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const left = keyReached();
    (left[Math.min(was.index, left.length - 1)] ?? bodyRef.current?.querySelector<HTMLElement>('[tabindex="0"]'))?.focus();
  });

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
    // The calendar hands back the very objects it was given: `events` are `T`.
    onEventClick:
      onEventClick || renderEventDetails || onEventDelete
        ? (event, target) => {
            dropPick();
            if (renderEventDetails) setOpened({ key: target.dataset.event ?? "", target });
            onEventClick?.(event as T);
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
          onEventChange(change as CalendarEventChange<T>);
        }
      : undefined,
    announce,
  };

  return (
    <EventDeleteContext.Provider value={Boolean(onEventDelete)}>
      <div
        role="group"
        aria-label={props["aria-labelledby"] ? undefined : labels.region}
        {...props}
        ref={mergeRefs(ref, rootRef)}
        onKeyDown={composeEventHandlers(props.onKeyDown, onDeleteKey)}
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
        {renderEventDetails &&
          openEvent &&
          detailsAnchor &&
          renderEventDetails({ event: openEvent as T, anchor: detailsAnchor, close: () => setOpened(null) })}
      </div>
    </EventDeleteContext.Provider>
  );
}
