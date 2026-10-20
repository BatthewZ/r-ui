import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { type DateRange, DateRangePicker, type DateRangePreset, toISODate, toISODateTime } from "../../../src/components/dates";
import { Field, Input, Select } from "../../../src/components/form";
import { Card, IconButton } from "../../../src/components/primitives";
import { LocaleProvider } from "../../../src/util/locale";
import { Cells, day, Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "DateRangePicker",
  group: "dates",
  order: 30,
  description:
    "The dashboard time range: a toolbar control at h-control showing the range compactly (or, with variant=\"field\", a field's box beside other fields), quick ranges beside typed start/end fields and a RangeCalendar. A preset applies at once; a custom range on Apply. `withTime` adds a TimeField beside each end.",
};

const shown = (v: DateRange<Date> | null) =>
  v ? `${toISODate(v.start)} → ${toISODate(v.end)}${v.preset ? ` (${v.preset})` : ""}` : "—";

/** The dashboard case: a compact card that clips, with the time range in its header. */
function ToolbarCard() {
  const [range, setRange] = useState<DateRange<Date> | null>({ start: day(10, 9), end: day(10, 15), preset: "last-7-days" });
  return (
    <Card data-density="compact" data-sc="range-toolbar-card" className="max-w-column-lg overflow-hidden">
      <Card.Header>
        <Card.Title>Checkout latency</Card.Title>
        <Card.Actions className="flex items-center gap-r6">
          <DateRangePicker aria-label="Time range" value={range} onValueChange={setRange} locale="en-US" />
          <IconButton label="Refresh" icon={<RefreshCw />} variant="secondary" />
        </Card.Actions>
      </Card.Header>
      <Card.Body>
        <output className="text-body-2 text-fg-secondary" data-sc="range-value">
          {shown(range)}
        </output>
      </Card.Body>
    </Card>
  );
}

/** The dashboard's range with times of day: presets roll to now, a custom range keeps its times. */
function TimedToolbarCard() {
  const [range, setRange] = useState<DateRange<Date> | null>({ start: new Date(2026, 9, 15, 9, 0), end: new Date(2026, 9, 15, 17, 30) });
  return (
    <Card data-density="compact" data-sc="range-time-card" className="max-w-column-lg overflow-hidden">
      <Card.Header>
        <Card.Title>Error rate</Card.Title>
        <Card.Actions>
          <DateRangePicker aria-label="Time range" withTime value={range} onValueChange={setRange} locale="en-US" name="window" />
        </Card.Actions>
      </Card.Header>
      <Card.Body>
        <output className="text-body-2 text-fg-secondary [overflow-wrap:anywhere]" data-sc="range-time-value">
          {range ? `${toISODateTime(range.start)} → ${toISODateTime(range.end)}${range.preset ? ` (${range.preset})` : ""}` : "—"}
        </output>
      </Card.Body>
    </Card>
  );
}

const SHIFTS: DateRangePreset[] = [
  { id: "today", label: "Today", range: (now) => ({ start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }) },
  { id: "q4", label: "Q4 2026", range: () => ({ start: day(10, 1), end: day(12, 31) }) },
];

export default function DateRangePickerSection() {
  const [custom, setCustom] = useState<DateRange<Date> | null>({ start: day(10, 1), end: day(10, 7) });
  return (
    <Stack>
      <Row label="Dashboard toolbar in a compact card that clips">
        <ToolbarCard />
      </Row>

      <Row label="With times of day (withTime): a working day 09:00 → 17:30, presets that end now, wall-clock times with their offset">
        <TimedToolbarCard />
      </Row>

      <Row label="24-hour times from a LocaleProvider (en-GB), in a Field">
        <LocaleProvider locale="en-GB">
          <Field data-sc="range-time-24h">
            <Field.Label>Incident window</Field.Label>
            <DateRangePicker
              withTime
              timeStep={5}
              defaultValue={{ start: new Date(2026, 9, 14, 22, 40), end: new Date(2026, 9, 15, 1, 5) }}
              className="justify-self-start"
            />
            <Field.Description>Across midnight; minutes step by 5.</Field.Description>
          </Field>
        </LocaleProvider>
      </Row>

      <Row label="In a Field · custom range · native submit as an ISO interval">
        <Grid>
          <Field data-sc="range-field">
            <Field.Label>Report period</Field.Label>
            <DateRangePicker name="period" value={custom} onValueChange={setCustom} locale="en-GB" className="justify-self-start" />
            <Field.Description>{shown(custom)}</Field.Description>
          </Field>
          <Field>
            <Field.Label>Zeitraum</Field.Label>
            <DateRangePicker
              locale="de-DE"
              defaultValue={{ start: day(10, 1), end: day(10, 7) }}
              labels={{ dialog: "Zeitraum wählen", presets: "Schnellauswahl", start: "Beginn", end: "Ende", apply: "Übernehmen", cancel: "Abbrechen", formatLetters: { day: "TT", month: "MM", year: "JJJJ" } }}
              presets={[]}
              className="justify-self-start"
            />
          </Field>
        </Grid>
      </Row>

      <Row label="Own presets · one month · bounded · empty · invalid · disabled">
        <div className="flex flex-wrap items-start gap-r4">
          <DateRangePicker aria-label="Shift" presets={SHIFTS} months={1} min={day(1, 1)} max={day(12, 31)} locale="en-US" />
          <DateRangePicker aria-label="Window" locale="en-US" />
          <DateRangePicker aria-label="Invalid range" invalid defaultValue={{ start: day(10, 1), end: day(10, 7) }} locale="en-US" />
          <DateRangePicker aria-label="Locked" disabled defaultValue={{ start: day(10, 1), end: day(10, 7), preset: "last-7-days" }} locale="en-US" />
        </div>
      </Row>

      <Row
        label={'As a field (variant="field") beside other fields: a field\'s box, the value at the start, the calendar at the end · empty · invalid · disabled'}
        data-sc="range-field-look"
      >
        <Cells>
          <Field>
            <Field.Label>Service</Field.Label>
            <Input placeholder="checkout-api" />
          </Field>
          <Field>
            <Field.Label>Environment</Field.Label>
            <Select defaultValue="production">
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </Select>
          </Field>
          <Field>
            <Field.Label>Incident window</Field.Label>
            <DateRangePicker variant="field" defaultValue={{ start: day(10, 1), end: day(10, 7) }} locale="en-US" />
          </Field>
          <Field>
            <Field.Label>Billing period</Field.Label>
            <DateRangePicker variant="field" placeholder="Any time" locale="en-US" />
          </Field>
          <Field invalid>
            <Field.Label>Audit range</Field.Label>
            <DateRangePicker variant="field" defaultValue={{ start: day(10, 1), end: day(10, 7) }} locale="en-US" />
            <Field.Error>Pick a range inside the retention window.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Archived range</Field.Label>
            <DateRangePicker variant="field" defaultValue={{ start: day(9, 1), end: day(9, 30) }} locale="en-US" />
          </Field>
        </Cells>
      </Row>
    </Stack>
  );
}
