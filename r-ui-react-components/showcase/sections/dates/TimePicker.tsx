import { type SubmitEvent, useState } from "react";

import { TimePicker } from "../../../src/components/dates";
import { Field, FormActions } from "../../../src/components/form";
import { Button, Card } from "../../../src/components/primitives";
import { LocaleProvider } from "../../../src/util/locale";
import { Cells, Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "TimePicker",
  group: "dates",
  order: 50,
  description:
    "A TimeField with a list of times at `step` in a popup (in place, top layer): the chosen time active and centred, arrows, Home / End, Page keys and typed digits move, Enter chooses. A window across midnight lists across it.",
};

/** The alert rule's "active hours", in a compact card that clips. */
function AlertRule() {
  const [submitted, setSubmitted] = useState("—");
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitted(`${String(data.get("from") || "(empty)")}–${String(data.get("until") || "(empty)")}`);
  };
  return (
    <Card data-density="compact" data-sc="alert-hours" className="max-w-column-lg overflow-hidden">
      <Card.Header>
        <Card.Title>Alert rule · Checkout latency</Card.Title>
      </Card.Header>
      <Card.Body>
        <form className="grid gap-r4" onSubmit={onSubmit}>
          <Cells>
            <Field name="from">
              <Field.Label>Active from</Field.Label>
              <TimePicker locale="en-GB" step={15} defaultValue="09:00" />
            </Field>
            <Field name="until">
              <Field.Label>Until</Field.Label>
              <TimePicker locale="en-GB" step={15} defaultValue="17:30" />
            </Field>
          </Cells>
          <output className="text-body-2 text-fg-secondary" data-sc="submitted">
            active = {submitted}
          </output>
          <FormActions>
            <Button type="submit" variant="secondary">
              Save rule
            </Button>
          </FormActions>
        </form>
      </Card.Body>
    </Card>
  );
}

export default function TimePickerSection() {
  return (
    <Stack>
      <Row label="Alert rule: active hours 09:00–17:30 in 15-minute steps, in a compact card that clips">
        <AlertRule />
      </Row>

      <Row label="12-hour and 24-hour lists from a LocaleProvider (en-US · en-GB)">
        <Grid>
          <LocaleProvider locale="en-US">
            <Field data-sc="picker-12h">
              <Field.Label>Reminder</Field.Label>
              <TimePicker defaultValue="14:30" />
            </Field>
          </LocaleProvider>
          <LocaleProvider locale="en-GB">
            <Field data-sc="picker-24h">
              <Field.Label>Reminder</Field.Label>
              <TimePicker defaultValue="14:30" />
            </Field>
          </LocaleProvider>
        </Grid>
      </Row>

      <Row label="Quiet hours across midnight (22:00–06:00, hourly) · empty · disabled · read-only">
        <Cells>
          <Field>
            <Field.Label>Quiet hours start</Field.Label>
            <TimePicker locale="en-GB" step={60} min="22:00" max="06:00" defaultValue="23:00" />
            <Field.Description>Times outside the window are refused.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Callback</Field.Label>
            <TimePicker locale="en-US" />
          </Field>
          <Field disabled>
            <Field.Label>Locked</Field.Label>
            <TimePicker locale="en-US" defaultValue="08:00" />
          </Field>
          <Field readOnly>
            <Field.Label>Scheduled</Field.Label>
            <TimePicker locale="en-US" defaultValue="08:00" />
          </Field>
        </Cells>
      </Row>

      <Row label="Right-to-left page (he-IL)">
        <LocaleProvider locale="he-IL" dir="rtl">
          <Field>
            <Field.Label>שעת התחלה</Field.Label>
            <TimePicker defaultValue="09:30" />
          </Field>
        </LocaleProvider>
      </Row>
    </Stack>
  );
}
