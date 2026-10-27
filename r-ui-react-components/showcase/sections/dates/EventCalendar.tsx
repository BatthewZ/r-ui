import { useState } from "react";

import {
  type CalendarEvent,
  type CalendarEventChange,
  type CalendarRange,
  EventCalendar,
  type EventCalendarView,
  toISODate,
} from "../../../src/components/dates";
import { Field, Input } from "../../../src/components/form";
import { Popover, useToast } from "../../../src/components/overlays";
import { Button, Link } from "../../../src/components/primitives";
import { day, Grid, Row, Stack } from "./parts/demo";
import { NOW, OPS_EVENTS, type OpsEvent } from "./parts/events";

export const meta = {
  title: "EventCalendar",
  group: "dates",
  order: 60,
  description:
    "Events on a calendar: a month grid (lanes for multi-day events, '+n more', a day panel; dots when the month is narrower than --MEASURE), a week or day time grid (two --ROW-H an hour, overlaps side by side, an all-day row, the now line) and an agenda. Events are links, buttons or text, each named in full. With the callbacks, a range can be picked (drag, slot cursor, the day panel) and events moved and resized (drag, or Space and arrows); the app owns the events.",
};

/** A link per event, for the agenda demo (the showcase's own hash routes, so following one stays here). */
const LINKED: CalendarEvent[] = OPS_EVENTS.map((event) => ({ ...event, href: `#/overview/dates-eventcalendar?event=${event.id}` }));

/** The app's own words for when an event is: "Thu, Oct 15, 10:00 – 11:00 AM", or the days of an all-day one. */
function sayWhen(event: OpsEvent): string {
  if (typeof event.start === "string") {
    const days = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
    const at = (iso: string) => new Date(`${iso}T00:00`);
    return days.formatRange(at(event.start), at(typeof event.end === "string" ? event.end : event.start));
  }
  const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const start = new Date(event.start);
  return event.end === undefined ? when.format(start) : when.formatRange(start, new Date(event.end));
}

/** The app's own surface for an opened event: everything it keeps, the calendar's short form left behind. */
function OpsDetails({ event, onClose }: { event: OpsEvent; onClose: () => void }) {
  return (
    <div className="grid gap-r4">
      <div className="grid gap-r6">
        <p className="text-body-1 font-semibold text-fg-primary">{event.title}</p>
        <p className="text-body-2 text-fg-secondary">{sayWhen(event)}</p>
      </div>
      {event.description && <p className="text-body-2 text-fg-primary">{event.description}</p>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-r4 gap-y-r6 text-body-2">
        {event.category && (
          <>
            <dt className="text-fg-secondary">Team</dt>
            <dd className="min-w-0 break-words">{event.category}</dd>
          </>
        )}
        {event.location && (
          <>
            <dt className="text-fg-secondary">Where</dt>
            <dd className="min-w-0 break-words">{event.location}</dd>
          </>
        )}
        {event.owner && (
          <>
            <dt className="text-fg-secondary">Owner</dt>
            <dd className="min-w-0 break-words">{event.owner}</dd>
          </>
        )}
      </dl>
      {event.attachments && event.attachments.length > 0 && (
        <ul className="grid gap-r6 text-body-2" aria-label="Attachments">
          {event.attachments.map((file) => (
            <li key={file.href} className="min-w-0 break-words">
              <Link href={file.href}>{file.name}</Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-end gap-r5">
        {event.runbook && <Link href={event.runbook}>Open runbook</Link>}
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function MainDemo() {
  const [view, setView] = useState<EventCalendarView>("month");
  const [date, setDate] = useState(day(10, 15));
  const [opened, setOpened] = useState<string>("—");
  return (
    <div className="grid min-w-0 gap-r5" data-sc="event-calendar-main">
      <EventCalendar<OpsEvent>
        aria-label="Operations calendar"
        events={OPS_EVENTS}
        now={NOW}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        onEventClick={(event) => setOpened(event.title)}
        renderEventDetails={({ event, anchor, close }) => (
          <Popover open anchor={anchor} placement="right-start" onOpenChange={(open) => !open && close()}>
            <Popover.Content aria-label={event.title} data-sc="event-calendar-details" className="w-(--COLUMN-LG)">
              <OpsDetails event={event} onClose={close} />
            </Popover.Content>
          </Popover>
        )}
      />
      <output className="text-body-2 text-fg-secondary" data-sc="event-calendar-state">
        {view} · {toISODate(date)} · opened: {opened}
      </output>
    </div>
  );
}

/** A change or a picked range in `CalendarEvent`'s own terms: all-day as `YYYY-MM-DD`, timed as instants. */
const placeOf = (range: CalendarRange): Pick<CalendarEvent, "start" | "end" | "allDay"> =>
  range.allDay ? { start: toISODate(range.start), end: toISODate(range.end) } : { start: range.start, end: range.end };

const at = (date: number, hour: number, minute = 0) => new Date(2026, 9, date, hour, minute);

const BOOKINGS: CalendarEvent[] = [
  { id: "b-standup", title: "Stand-up", start: at(13, 9, 30), end: at(13, 9, 45), slot: 1, category: "Platform team" },
  { id: "b-review", title: "Design review", start: at(14, 10), end: at(14, 11, 30), slot: 2, category: "Product" },
  { id: "b-interview", title: "Interview", start: at(15, 13), end: at(15, 14), slot: 3, category: "Hiring" },
  { id: "b-offsite", title: "Team offsite", start: "2026-10-15", end: "2026-10-16", slot: 4, category: "Company" },
  { id: "b-holiday", title: "Public holiday", start: "2026-10-12", editable: false, category: "Company" },
];

/** "Thu, Oct 15, 10:00 – 11:30 AM", or "Thu, Oct 15 – Sat, Oct 17" for days: the app's own words for a range. */
function sayRange(range: CalendarRange): string {
  const days = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (range.allDay) return days.formatRange(range.start, range.end);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatRange(
    range.start,
    range.end,
  );
}

/**
 * The app's own surface for a picked range: here a popover at the pick (it could
 * as well be a drawer or a dialog). The calendar only says where the range is.
 */
function NewBooking({ range, onAdd, onCancel }: { range: CalendarRange; onAdd: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="grid gap-r4"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(title.trim() || "New booking");
      }}
    >
      <p className="text-body-2 text-fg-secondary" data-sc="event-calendar-edit-range">
        {sayRange(range)}
      </p>
      <Field>
        <Field.Label>Title</Field.Label>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New booking" />
      </Field>
      <div className="flex flex-wrap justify-end gap-r5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Add booking</Button>
      </div>
    </form>
  );
}

/** The app's side: it owns the events, moves one when told, and adds one for a picked range from its own panel. */
function EditableDemo() {
  const [events, setEvents] = useState(BOOKINGS);
  const [selection, setSelection] = useState<CalendarRange | null>(null);
  const [last, setLast] = useState("—");
  const { toast } = useToast();
  // Delete at once and say so, with an Undo that puts the booking back where it was.
  const onEventDelete = (event: CalendarEvent) => {
    const index = events.findIndex((e) => e.id === event.id);
    if (index < 0) return;
    setEvents((list) => list.filter((e) => e.id !== event.id));
    setLast(`delete ${event.id}`);
    toast({
      title: `Deleted “${event.title}”`,
      action: {
        label: "Undo",
        onClick: () => {
          setEvents((list) => (list.some((e) => e.id === event.id) ? list : [...list.slice(0, index), event, ...list.slice(index)]));
          setLast(`undo ${event.id}`);
        },
      },
    });
  };
  const onEventChange = (change: CalendarEventChange) => {
    setEvents((list) => list.map((e) => (e.id === change.event.id ? { ...e, ...placeOf(change) } : e)));
    setLast(`${change.kind} ${change.event.id}`);
  };
  const add = (range: CalendarRange, title: string) => {
    setEvents((list) => [...list, { id: `new-${list.length}`, title, ...placeOf(range), slot: 5, category: "Bookings" }]);
    setSelection(null);
    setLast(`add new-${events.length}`);
  };
  return (
    <div className="grid min-w-0 gap-r5" data-sc="event-calendar-edit">
      <EventCalendar
        aria-label="Room bookings"
        events={events}
        now={NOW}
        defaultView="week"
        defaultDate={day(10, 15)}
        views={["week", "day", "month"]}
        selection={selection}
        onSelectionChange={setSelection}
        onEventChange={onEventChange}
        onEventDelete={onEventDelete}
        onEventClick={() => {}}
        renderSelection={({ range, anchor, clear }) => (
          // Closing (Escape, a press outside) drops the pick; a press on another slot starts a new one.
          <Popover open anchor={anchor} placement="right-start" onOpenChange={(open) => !open && clear()}>
            <Popover.Content aria-label="New booking" data-sc="event-calendar-edit-panel">
              <NewBooking key={`${range.start.getTime()}-${range.end.getTime()}`} range={range} onAdd={(title) => add(range, title)} onCancel={clear} />
            </Popover.Content>
          </Popover>
        )}
      />
      <div className="flex flex-wrap items-center gap-r4">
        <output className="text-body-2 text-fg-secondary" data-sc="event-calendar-edit-state">
          selection: {selection ? `${selection.allDay ? "all-day " : ""}${selection.start.toISOString()} → ${selection.end.toISOString()}` : "none"} · last: {last}
        </output>
      </div>
    </div>
  );
}

export default function EventCalendarSection() {
  return (
    <Stack>
      <Row label="An ops month: multi-day lanes, a crowded day's '+n more', the day panel by Enter or a press; an event opens the app's own details (its owner, runbook, attachments)">
        <MainDemo />
      </Row>

      {/* The time grid scrolls sideways by design when its days do not fit. */}
      <Row label="Editable · pick a range (drag, or Shift+arrows then Enter) and the app's own panel opens at it; drag an event or its end; Space picks one up; Delete removes one, with Undo in a toast" data-sc-scrolls="">
        <EditableDemo />
      </Row>

      <Row label="Week: overlaps side by side, an all-day row, a migration across midnight, the now line" data-sc="event-calendar-week" data-sc-scrolls="">
        <EventCalendar aria-label="Team week" events={OPS_EVENTS} now={NOW} defaultView="week" defaultDate={day(10, 15)} onEventClick={() => {}} />
      </Row>

      <Row label="Agenda: every event a link" data-sc="event-calendar-agenda">
        <EventCalendar
          aria-label="Linked agenda"
          events={LINKED}
          now={NOW}
          defaultView="agenda"
          defaultDate={day(10, 15)}
          views={["agenda", "month"]}
        />
      </Row>

      <Row label="Narrower than --MEASURE: dots, and the day panel lists the day" data-sc="event-calendar-narrow">
        <div className="max-w-(--COLUMN-LG)">
          <EventCalendar aria-label="Narrow calendar" events={OPS_EVENTS} now={NOW} defaultDate={day(10, 15)} views={["month", "agenda"]} />
        </div>
      </Row>

      <Row label="de-DE: Monday first, 24-hour times" data-sc-scrolls="">
        <EventCalendar aria-label="Kalender" locale="de-DE" events={OPS_EVENTS} now={NOW} defaultView="week" defaultDate={day(10, 15)} />
      </Row>

      <Row label="ar-EG: right to left, Saturday first, Arabic-Indic digits">
        <div dir="rtl" lang="ar-EG" data-sc="event-calendar-rtl">
          <EventCalendar aria-label="التقويم" locale="ar-EG" events={OPS_EVENTS} now={NOW} defaultDate={day(10, 15)} />
        </div>
      </Row>

      <Row label="Compact · loading · an empty month · text events (no onEventClick)">
        <Grid>
          <div data-density="compact" data-sc="event-calendar-compact">
            <EventCalendar aria-label="Compact" events={OPS_EVENTS} now={NOW} defaultView="day" defaultDate={day(10, 15)} />
          </div>
          <div className="grid gap-r3">
            <EventCalendar aria-label="Loading" events={[]} now={NOW} loading defaultView="agenda" defaultDate={day(10, 15)} />
            <EventCalendar aria-label="Empty" events={[]} now={NOW} defaultDate={day(12, 1)} views={["month"]} />
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
