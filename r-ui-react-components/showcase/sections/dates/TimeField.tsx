import { type ReactNode, type SubmitEvent, useState } from "react";

import { DatePicker, TimeField } from "../../../src/components/dates";
import { Field, FormActions } from "../../../src/components/form";
import { Button, Card } from "../../../src/components/primitives";
import { LocaleProvider } from "../../../src/util/locale";
import { CELLS, Cells, Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "TimeField",
  group: "dates",
  order: 40,
  description:
    "A time of day as spinbutton segments in the locale's order, digits and clock (12-hour with AM/PM, or 24-hour), from the LocaleProvider. Arrows wrap, digits type and move on, Backspace empties; `name` submits HH:mm (24-hour, wall-clock, no zone).",
};

/** A native form that shows what `name` submits. */
function Submits({ sc, label, children }: { sc: string; label: string; children: ReactNode }) {
  const [submitted, setSubmitted] = useState("—");
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(String(new FormData(event.currentTarget).get("at") || "(empty)"));
  };
  return (
    <form className="grid content-start gap-r4" data-sc={sc} onSubmit={onSubmit}>
      <Field name="at">
        <Field.Label>{label}</Field.Label>
        {children}
      </Field>
      <output className="text-body-2 text-fg-secondary" data-sc="submitted">
        at = {submitted}
      </output>
      {/* FormActions keeps focus in the field on the press, so the field's
          blur-time message cannot move the button out from under the click. */}
      <FormActions>
        <Button type="submit" variant="secondary">
          Submit
        </Button>
      </FormActions>
    </form>
  );
}

export default function TimeFieldSection() {
  return (
    <Stack>
      <Row label="The locale's clock, from a LocaleProvider: en-US (12-hour) · de-DE (24-hour)">
        <Grid>
          <LocaleProvider locale="en-US">
            <Submits sc="time-12h" label="Starts at">
              <TimeField />
            </Submits>
          </LocaleProvider>
          <LocaleProvider locale="de-DE" labels={{ TimeField: { hour: "Stunden", minute: "Minuten", empty: "Leer" } }}>
            <Submits sc="time-24h" label="Beginnt um">
              <TimeField />
            </Submits>
          </LocaleProvider>
        </Grid>
      </Row>

      <Row label="Other clocks: the day period first (ko-KR) · Arabic digits in a right-to-left page (ar-EG) · a forced 24-hour clock in en-US">
        <Cells>
          <Field>
            <Field.Label>알람</Field.Label>
            <TimeField locale="ko-KR" defaultValue="07:30" />
          </Field>
          <LocaleProvider locale="ar-EG" dir="rtl">
            <Field data-sc="time-rtl">
              <Field.Label>وقت البدء</Field.Label>
              <TimeField defaultValue="21:05" />
              <Field.Description>الأرقام بترتيب اللغة، من اليسار إلى اليمين.</Field.Description>
            </Field>
          </LocaleProvider>
          <Field>
            <Field.Label>Deploy window opens</Field.Label>
            <TimeField locale="en-US" hourCycle={24} defaultValue="21:05" />
          </Field>
        </Cells>
      </Row>

      <Row label="Seconds · minutes in steps of 15 · bounds 09:00–17:30 with a refused time · required, empty">
        <Grid>
          <Field>
            <Field.Label>Cron offset</Field.Label>
            <TimeField locale="en-GB" withSeconds defaultValue="00:15:30" />
            <Field.Description>HH:mm:ss, 24-hour.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Standup</Field.Label>
            <TimeField locale="en-US" step={15} defaultValue="09:45" />
            <Field.Description>Arrows move the minutes by 15.</Field.Description>
          </Field>
          <Field data-sc="time-bounded">
            <Field.Label>Office hours start</Field.Label>
            <TimeField locale="en-US" min="09:00" max="17:30" defaultValue="18:00" />
          </Field>
          <Field required>
            <Field.Label>Pickup time with a long label that wraps onto a second line in a narrow column</Field.Label>
            <TimeField locale="en-US" />
          </Field>
        </Grid>
      </Row>

      <Row label="Invalid from the Field · disabled · read-only">
        <Cells>
          <Field>
            <Field.Label>Cutoff</Field.Label>
            <TimeField locale="en-US" defaultValue="23:30" invalid />
            <Field.Error>The cutoff must be before the batch run.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Archived at</Field.Label>
            <TimeField locale="en-US" defaultValue="14:00" />
          </Field>
          <Field readOnly>
            <Field.Label>Created at</Field.Label>
            <TimeField locale="en-US" defaultValue="08:12" />
          </Field>
        </Cells>
      </Row>

      <Row label="A date and a time as two values: DatePicker (YYYY-MM-DD) beside TimeField (HH:mm)">
        <Cells>
          <Field>
            <Field.Label>Snooze until</Field.Label>
            <DatePicker locale="en-US" defaultValue={new Date(2026, 9, 16)} />
          </Field>
          <Field>
            <Field.Label>at</Field.Label>
            <TimeField locale="en-US" defaultValue="08:00" />
          </Field>
        </Cells>
      </Row>

      <Row label="In a compact card">
        <Card data-density="compact" data-sc="time-compact-card" className="max-w-column-md">
          <Card.Header>
            <Card.Title>Maintenance</Card.Title>
          </Card.Header>
          <Card.Body className={CELLS}>
            <Field>
              <Field.Label>From</Field.Label>
              <TimeField locale="en-GB" defaultValue="02:00" />
            </Field>
            <Field>
              <Field.Label>Until</Field.Label>
              <TimeField locale="en-GB" defaultValue="04:30" />
            </Field>
          </Card.Body>
        </Card>
      </Row>
    </Stack>
  );
}
