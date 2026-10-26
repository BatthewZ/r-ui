"use client";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { type Tone, TONE_LABELS } from "../../util/tone";
import { safeUrl } from "../../util/url";
import type { SeriesSlot } from "../data";
import { addDays, dateFormatter, isSameDay, type Weekday } from "./date-core";
import type { CalendarEvent, EventCalendarView, Period, PlacedEvent } from "./event-core";

/*
 * What the EventCalendar's views share: the labels, the props every view
 * takes, the element an event is drawn as, the entity mark, and how an event's
 * time and name read. Internal to the dates group (the barrel exports the
 * labels and types only).
 */

/** Every string the EventCalendar speaks or shows that `Intl` does not supply. */
export interface EventCalendarLabels {
  /** The calendar's name when it has no `aria-label`. */
  region: string;
  /** The button that goes to today. */
  today: string;
  /** The toolbar's previous and next buttons, per view ("Previous month"). */
  previous: Record<EventCalendarView, string>;
  next: Record<EventCalendarView, string>;
  /** The view switch's segments, and its name. */
  views: Record<EventCalendarView, string>;
  viewSwitch: string;
  /** An all-day event's time, and the time grid's all-day row. */
  allDay: string;
  /** A crowded day's visible "+3 more". */
  more: (count: number) => string;
  /** Folds a list "+n more" opened back up. */
  showFewer: string;
  /** How many events a day has, said with the day ("3 events"; 0 is "No events"). */
  dayEvents: (count: number) => string;
  /** Appended to today's name. */
  currentDay: string;
  /** The day panel's button to the day view. */
  openDay: string;
  /** The agenda when the period has no events. */
  emptyPeriod: string;
  /** Announced while `loading`. */
  loading: string;
  /** The status word per tone, where an event sets no `statusLabel`. */
  tones: Record<Tone, string>;
}

export const DEFAULT_EVENT_CALENDAR_LABELS: EventCalendarLabels = {
  region: "Calendar",
  today: "Today",
  previous: { month: "Previous month", week: "Previous week", day: "Previous day", agenda: "Previous month" },
  next: { month: "Next month", week: "Next week", day: "Next day", agenda: "Next month" },
  views: { month: "Month", week: "Week", day: "Day", agenda: "Agenda" },
  viewSwitch: "View",
  allDay: "All day",
  more: (count) => `+${count} more`,
  showFewer: "Show fewer",
  dayEvents: (count) => (count === 0 ? "No events" : count === 1 ? "1 event" : `${count} events`),
  currentDay: "today",
  openDay: "Open day",
  emptyPeriod: "Nothing scheduled",
  loading: "Loading events",
  tones: TONE_LABELS,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    EventCalendar: EventCalendarLabels;
  }
}

export type EventCalendarSlot = "toolbar" | "title" | "views" | "body" | "event";

/** What the shell hands every view. */
export interface EventViewProps {
  /** Every placed event, sorted by start (`placeEvents`); a view picks its own. */
  placed: readonly PlacedEvent[];
  /** The active day: the view's tab stop and the anchor of its period. */
  date: Date;
  /**
   * Make `day` the active day. A view that moved it by keyboard focuses it after
   * the render that shows it (paging the period first when it left it).
   */
  onDateChange: (day: Date) => void;
  /** The days this view shows (`periodOf`). */
  period: Period;
  /** The period as the toolbar shows it ("October 2026"): a name for the view's grid or list. */
  title: string;
  weekStart: Weekday;
  /** A resolved BCP 47 tag. */
  locale: string;
  /** The clock (epoch ms): today, and the time grid's now line. */
  now: number;
  labels: EventCalendarLabels;
  onEventClick?: (event: CalendarEvent) => void;
  /** Show the day view on `day`; absent when the calendar offers no day view. */
  onOpenDay?: (day: Date) => void;
  classNames?: SlotClassNames<EventCalendarSlot>;
}

// ── Reading an event ───────────────────────────────────────────────────────

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const SHORT_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** "Thursday, October 15": a day said in full, without the year. */
export function dayName(day: Date, locale: string): string {
  return dateFormatter(locale, { weekday: "long", month: "long", day: "numeric" }).format(day);
}

/** A time of day in the locale's own form ("9:00 AM", "09:00"). */
export function formatTimeOfDay(ms: number, locale: string): string {
  return dateFormatter(locale, TIME).format(ms);
}

/**
 * When an event happens, as the locale writes it: "All day", "Oct 6 – 8"
 * (all-day over several days), "9:00 – 9:30 AM", "9:00 AM" (a moment), or
 * "Oct 15, 11:00 PM – Oct 16, 2:30 AM" (timed over midnight).
 */
export function formatEventTime(p: PlacedEvent, locale: string, labels: Pick<EventCalendarLabels, "allDay">): string {
  if (p.allDay) {
    if (isSameDay(p.firstDay, p.lastDay)) return labels.allDay;
    return dateFormatter(locale, SHORT_DAY).formatRange(p.firstDay, p.lastDay);
  }
  if (p.end === p.start) return formatTimeOfDay(p.start, locale);
  if (isSameDay(p.firstDay, p.lastDay)) return dateFormatter(locale, TIME).formatRange(p.start, p.end);
  return dateFormatter(locale, { ...SHORT_DAY, ...TIME }).formatRange(p.start, p.end);
}

/** The status word an event says, or "" (no tone, or a tone with no word). */
export function statusWord(event: CalendarEvent, labels: Pick<EventCalendarLabels, "tones">): string {
  if (!event.tone) return "";
  return event.statusLabel ?? labels.tones[event.tone] ?? "";
}

/**
 * The event's full name, which every view gives it (a short block or chip
 * shows less): title, then when (with its day, when `withDay` names one and the
 * time alone does not), its category, its status and its location.
 */
export function eventName(
  p: PlacedEvent,
  locale: string,
  labels: Pick<EventCalendarLabels, "allDay" | "tones">,
  withDay?: Date,
): string {
  const when = formatEventTime(p, locale, labels);
  const oneDay = isSameDay(p.firstDay, p.lastDay);
  const day = withDay && oneDay ? `${dayName(p.firstDay, locale)}, ` : "";
  return [p.event.title, `${day}${when}`, p.event.category, statusWord(p.event, labels), p.event.location]
    .filter((part) => part !== undefined && part !== "")
    .join(", ");
}

/** The days `[start, end)` as dates, one per day. */
export function periodDays(period: Period): Date[] {
  const out: Date[] = [];
  for (let day = period.start; day.getTime() < period.end.getTime(); day = addDays(day, 1)) out.push(day);
  return out;
}

// ── Drawing an event ───────────────────────────────────────────────────────

/** An entity's mark colour: literal classes so Tailwind's scanner sees each one. */
export const SLOT_BG: Record<SeriesSlot, string> = {
  1: "bg-series-1",
  2: "bg-series-2",
  3: "bg-series-3",
  4: "bg-series-4",
  5: "bg-series-5",
  6: "bg-series-6",
  7: "bg-series-7",
  8: "bg-series-8",
};

/**
 * The entity's mark: its series colour (printed as is), or the secondary ink
 * when the event names no slot. Decorative: the category is in the name.
 * `className` gives it its shape (a stripe, a dot).
 */
export function EventMark({ slot, className }: { slot?: SeriesSlot; className?: string }) {
  return (
    <span
      aria-hidden
      data-print="exact"
      className={cn("r-dates-event-mark shrink-0", slot ? SLOT_BG[slot] : "bg-fg-secondary", className)}
    />
  );
}

/** The event's link, when it has a safe `href`. */
const eventHref = (p: PlacedEvent) => (p.event.href ? safeUrl(p.event.href) || undefined : undefined);

/**
 * Whether `EventTarget` draws `p` as a link or a button, so it can take focus
 * and a press. Text events (no safe `href`, no `onEventClick`) never can.
 */
export function isInteractiveEvent(p: PlacedEvent, onEventClick: EventViewProps["onEventClick"]): boolean {
  return Boolean(onEventClick) || eventHref(p) !== undefined;
}

export type EventTargetProps = Omit<ComponentPropsWithRef<"div">, "children" | "title" | "onClick"> & {
  placed: PlacedEvent;
  /** The full name (`eventName`). */
  name: string;
  onEventClick?: (event: CalendarEvent) => void;
  children: ReactNode;
};

/**
 * The element an event is drawn as: a link when it has a safe `href` (the
 * `RouterProvider`'s link for an internal path), a button when the calendar
 * has an `onEventClick`, else text. Its accessible name is always the full
 * `name` (the visible content is a summary): interactive targets carry it as
 * `aria-label`, plain text as a visually hidden copy beside a hidden summary.
 * The pointer's hover title is the name and the description. `tabIndex`
 * applies to links and buttons only: text is never focusable.
 */
export function EventTarget({ placed, name, onEventClick, className, children, tabIndex, ...props }: EventTargetProps) {
  const href = eventHref(placed);
  const Link = useLinkElement(undefined, href);
  const title = placed.event.description ? `${name}\n${placed.event.description}` : name;
  const shared = {
    ...props,
    title,
    "data-event": placed.key,
    className: cn("r-dates-event", className),
  };
  if (href) {
    return (
      <Link {...shared} href={href} aria-label={name} tabIndex={tabIndex} onClick={onEventClick ? () => onEventClick(placed.event) : undefined}>
        {children}
      </Link>
    );
  }
  if (onEventClick) {
    return (
      <button
        {...(shared as ComponentPropsWithRef<"button">)}
        type="button"
        aria-label={name}
        tabIndex={tabIndex}
        onClick={() => onEventClick(placed.event)}
      >
        {children}
      </button>
    );
  }
  return (
    <div {...shared}>
      <span className="sr-only">{name}</span>
      <span aria-hidden className="contents">
        {children}
      </span>
    </div>
  );
}
