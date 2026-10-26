import { useState } from "react";

import { type CalendarEvent, EventCalendar, type EventCalendarView, toISODate } from "../../../src/components/dates";
import { day, Grid, Row, Stack } from "./parts/demo";
import { NOW, OPS_EVENTS } from "./parts/events";

export const meta = {
  title: "EventCalendar",
  group: "dates",
  order: 60,
  description:
    "Events on a calendar: a month grid (lanes for multi-day events, '+n more', a day panel; dots when the month is narrower than --MEASURE), a week or day time grid (two --ROW-H an hour, overlaps side by side, an all-day row, the now line) and an agenda. Read-only: links, buttons or text, each named in full. View and date are controllable.",
};

/** A link per event, for the agenda demo (the showcase's own hash routes, so following one stays here). */
const LINKED: CalendarEvent[] = OPS_EVENTS.map((event) => ({ ...event, href: `#/overview/dates-eventcalendar?event=${event.id}` }));

function MainDemo() {
  const [view, setView] = useState<EventCalendarView>("month");
  const [date, setDate] = useState(day(10, 15));
  const [opened, setOpened] = useState<string>("—");
  return (
    <div className="grid min-w-0 gap-r5" data-sc="event-calendar-main">
      <EventCalendar
        aria-label="Operations calendar"
        events={OPS_EVENTS}
        now={NOW}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        onEventClick={(event) => setOpened(event.title)}
      />
      <output className="text-body-2 text-fg-secondary" data-sc="event-calendar-state">
        {view} · {toISODate(date)} · opened: {opened}
      </output>
    </div>
  );
}

export default function EventCalendarSection() {
  return (
    <Stack>
      <Row label="An ops month: multi-day lanes, a crowded day's '+n more', the day panel by Enter or a press">
        <MainDemo />
      </Row>

      {/* The time grid scrolls sideways by design when its days do not fit. */}
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
