"use client";
import { useId, useMemo } from "react";

import { cn } from "../../util/style";
import { MARK_TEXT, TONE_TEXT, ToneGlyph } from "../../util/tone";
import { EmptyState } from "../data";
import { isSameDay, startOfDay, toISODate } from "./date-core";
import { dayOrder, occursOn, type PlacedEvent, touchesDays } from "./event-core";
import {
  dayName,
  EventMark,
  EventTarget,
  type EventViewProps,
  eventName,
  formatEventTime,
  isInteractiveEvent,
  periodDays,
  statusWord,
} from "./event-parts";

export interface EventAgendaProps extends EventViewProps {
  /** The calendar is loading: an empty period is not yet "nothing scheduled". */
  loading?: boolean;
}

/*
 * A row: the time, the entity's stripe, then what and where. Narrower than
 * `@md` the time sits above the title, the stripe running down both.
 */
const ROW = "grid min-h-row grid-cols-[auto_minmax(0,1fr)] items-start gap-x-r3 gap-y-r6 rounded-md px-r4 py-r5 @md:grid-cols-[var(--COLUMN-SM)_auto_minmax(0,1fr)]";
const TIME = "col-start-2 row-start-1 text-body-2 tabular-nums text-fg-secondary @md:col-start-1 @md:text-body-1";
const MARK = "r-dates-event-stripe col-start-1 row-span-2 row-start-1 @md:col-start-2 @md:row-span-1";
const BODY = "col-start-2 row-start-2 flex min-w-0 flex-col gap-r6 @md:col-start-3 @md:row-start-1";

/**
 * The agenda: every day of the period that has events, in order, each a list
 * of its events in day order (all-day and multi-day first). A multi-day event
 * is listed on each of its days inside the period, with its full time. The
 * agenda shows each event in full: time, title, category, location, status
 * and description.
 */
export function EventAgenda({
  placed,
  period,
  title,
  locale,
  now,
  labels,
  onEventClick,
  classNames,
  loading = false,
}: EventAgendaProps) {
  const baseId = useId();
  const today = startOfDay(new Date(now));
  const periodStart = period.start.getTime();
  const periodEnd = period.end.getTime();
  const days = useMemo(() => {
    const from = new Date(periodStart);
    const inPeriod = placed.filter((p) => touchesDays(p, from, new Date(periodEnd)));
    return periodDays({ start: from, end: new Date(periodEnd) })
      .map((day) => ({ day, events: inPeriod.filter((p) => occursOn(p, day)).sort(dayOrder) }))
      .filter((d) => d.events.length > 0);
  }, [placed, periodStart, periodEnd]);

  if (days.length === 0) {
    return loading ? null : <EmptyState title={labels.emptyPeriod} className="py-r2" />;
  }

  return (
    <ol aria-label={title} data-agenda="" className="flex min-w-0 flex-col gap-r3">
      {days.map(({ day, events }) => {
        const headerId = `${baseId}-${toISODate(day)}`;
        const isToday = isSameDay(day, today);
        return (
          <li key={headerId} className="flex min-w-0 flex-col gap-r6">
            <div
              id={headerId}
              data-agenda-day={toISODate(day)}
              className="flex min-w-0 items-center border-b border-border pb-r5 text-body-2 font-semibold text-fg-secondary"
            >
              <span
                data-today={isToday ? "" : undefined}
                className={cn(
                  "min-w-0 break-words",
                  isToday && "rounded-full bg-accent px-r5 text-fg-on-accent",
                )}
              >
                {dayName(day, locale)}
              </span>
              {isToday && <span className="sr-only">, {labels.currentDay}</span>}
            </div>
            <ul aria-labelledby={headerId} className="flex min-w-0 flex-col">
              {events.map((p) => (
                <li key={p.key} className="min-w-0">
                  <AgendaEvent
                    placed={p}
                    day={day}
                    locale={locale}
                    labels={labels}
                    onEventClick={onEventClick}
                    className={classNames?.event}
                  />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function AgendaEvent({
  placed: p,
  day,
  locale,
  labels,
  onEventClick,
  className,
}: Pick<EventViewProps, "locale" | "labels" | "onEventClick"> & { placed: PlacedEvent; day: Date; className?: string }) {
  const { event } = p;
  const interactive = isInteractiveEvent(p, onEventClick);
  const word = statusWord(event, labels);
  const where = [event.category, event.location].filter(Boolean).join(" · ");
  return (
    <EventTarget
      placed={p}
      name={eventName(p, locale, labels, day)}
      onEventClick={onEventClick}
      className={cn(ROW, interactive && "hover:bg-fg-primary/8", className)}
    >
      <span data-agenda-time="" className={TIME}>{formatEventTime(p, locale, labels)}</span>
      <EventMark slot={event.slot} className={MARK} />
      <span className={BODY}>
        <span data-agenda-title="" dir="auto" className="min-w-0 break-words text-body-1 font-semibold text-fg-primary">
          {event.title}
        </span>
        {(word || where) && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-r4 gap-y-r6 text-body-2 text-fg-secondary">
            {word && event.tone && (
              <span data-agenda-status="" className={cn("inline-flex min-w-0 items-center gap-r6 font-medium", TONE_TEXT[event.tone])}>
                <ToneGlyph tone={event.tone} className={cn("size-icon shrink-0", MARK_TEXT[event.tone])} />
                <span className="min-w-0 break-words">{word}</span>
              </span>
            )}
            {where && <span className="min-w-0 break-words">{where}</span>}
          </span>
        )}
        {event.description && (
          <span className="min-w-0 break-words text-body-2 text-fg-secondary">{event.description}</span>
        )}
      </span>
    </EventTarget>
  );
}
