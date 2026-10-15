import { useState } from "react";

import { Calendar, type DateRange, RangeCalendar, toISODate } from "../../../src/components/dates";
import { day, Grid, isWeekend, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Calendar",
  group: "dates",
  order: 10,
  description:
    "Month grids on the APG keyboard model (arrows, Home/End, PageUp/PageDown, Shift for years), with names, digits and week start from Intl. Cells are --CONTROL-H square; months sit side by side while the calendar's own width holds them.",
};

const iso = (d: Date | null) => (d ? toISODate(d) : "—");

function SingleDemo() {
  const [value, setValue] = useState<Date | null>(day(10, 30));
  return (
    <div className="grid justify-items-start gap-r5" data-sc="calendar-single">
      <Calendar aria-label="Due date" value={value} onValueChange={setValue} />
      <output className="text-body-2 text-fg-secondary">Selected: {iso(value)}</output>
    </div>
  );
}

function RangeDemo() {
  const [range, setRange] = useState<DateRange>({ start: day(10, 6), end: day(10, 14) });
  return (
    <div className="grid min-w-0 gap-r5" data-sc="range-calendar">
      <RangeCalendar aria-label="Maintenance window" value={range} onValueChange={setRange} />
      <output className="text-body-2 text-fg-secondary" data-sc="range-output">
        {iso(range.start)} → {iso(range.end)}
      </output>
    </div>
  );
}

export default function CalendarSection() {
  return (
    <Stack>
      <Row label="Single date · today marked · keyboard crosses months">
        <SingleDemo />
      </Row>

      <Row label="Range · two months while the container is wide, one when it is not">
        <RangeDemo />
      </Row>

      <Row label="Bounds and unavailable days (5 Oct – 20 Nov, no weekends)">
        <Calendar
          aria-label="Delivery day"
          defaultMonth={day(10, 1)}
          min={day(10, 5)}
          max={day(11, 20)}
          isDateUnavailable={isWeekend}
          className="justify-self-start"
        />
      </Row>

      <Row label="Locales: week start and names from Intl">
        <Grid>
          <div className="grid gap-r5">
            <span className="text-body-2 text-fg-secondary">de-DE (Monday first)</span>
            <Calendar aria-label="Datum" locale="de-DE" defaultValue={day(10, 15)} />
          </div>
          <div dir="rtl" lang="ar-EG" className="grid gap-r5">
            <span className="text-body-2 text-fg-secondary">ar-EG, RTL (Saturday first)</span>
            <RangeCalendar aria-label="الفترة" locale="ar-EG" months={1} defaultValue={{ start: day(10, 11), end: day(10, 17) }} />
          </div>
        </Grid>
      </Row>

      <Row label="Compact · disabled">
        <Grid>
          <div data-density="compact">
            <Calendar aria-label="Compact" defaultValue={day(10, 20)} />
          </div>
          <Calendar aria-label="Disabled" disabled defaultValue={day(10, 20)} />
        </Grid>
      </Row>
    </Stack>
  );
}
