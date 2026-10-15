import { type SubmitEvent, useState } from "react";

import { DatePicker } from "../../../src/components/dates";
import { Field } from "../../../src/components/form";
import { Button } from "../../../src/components/primitives";
import { day, Grid, isWeekend, Row, Stack } from "./parts/demo";

export const meta = {
  title: "DatePicker",
  group: "dates",
  order: 20,
  description:
    "Type a date in the user's locale (the pattern is shown) or open the calendar in a popup: in place, top layer, fading out. A refused entry stays in the field with its reason in the Field error's look; `name` submits YYYY-MM-DD.",
};

function NativeForm({ locale, sc, label, pattern }: { locale: string; sc: string; label: string; pattern: string }) {
  const [submitted, setSubmitted] = useState("—");
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(String(new FormData(event.currentTarget).get("due") || "(empty)"));
  };
  return (
    <form className="grid content-start gap-r4" data-sc={sc} onSubmit={onSubmit}>
      <Field>
        <Field.Label>{label}</Field.Label>
        <DatePicker name="due" locale={locale} />
        <Field.Description>{pattern}</Field.Description>
      </Field>
      <div className="flex flex-wrap items-center gap-r4">
        <Button type="submit" variant="secondary">
          Submit
        </Button>
        <output className="text-body-2 text-fg-secondary" data-sc="submitted">
          due = {submitted}
        </output>
      </div>
    </form>
  );
}

export default function DatePickerSection() {
  return (
    <Stack>
      <Row label="Typed entry per locale, submitted natively">
        <Grid>
          <NativeForm locale="en-US" sc="datepicker-en" label="Due date" pattern="Month first, as en-US writes it." />
          <NativeForm locale="de-DE" sc="datepicker-de" label="Fälligkeitsdatum" pattern="Tag zuerst, wie im Deutschen." />
        </Grid>
      </Row>

      <Row label="Bounds, unavailable days, required · an entry the rules refuse">
        <Grid>
          <Field required>
            <Field.Label>Delivery day</Field.Label>
            <DatePicker locale="en-GB" min={day(10, 5)} max={day(11, 20)} isDateUnavailable={isWeekend} defaultValue={day(10, 21)} />
            <Field.Description>Weekdays from 5 October to 20 November.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Go-live</Field.Label>
            <DatePicker locale="en-US" hint={null} invalid defaultValue={day(9, 30)} />
            <Field.Error>Go-live must be after the freeze ends.</Field.Error>
          </Field>
        </Grid>
      </Row>

      <Row label="Disabled · read-only · two months in the popup">
        <Grid>
          <Field disabled>
            <Field.Label>Archived on</Field.Label>
            <DatePicker defaultValue={day(3, 2)} locale="en-US" />
          </Field>
          <Field readOnly>
            <Field.Label>Created</Field.Label>
            <DatePicker defaultValue={day(1, 14)} locale="en-US" />
          </Field>
          <Field>
            <Field.Label>Review date</Field.Label>
            <DatePicker months={2} locale="en-US" defaultValue={day(10, 28)} />
          </Field>
        </Grid>
      </Row>

      <Row label="Inside a compact card that clips (overflow: hidden)">
        <div
          data-density="compact"
          data-sc="datepicker-clip"
          className="flex max-w-column-lg flex-col gap-r3 overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-1 p-r3"
        >
          <Field>
            <Field.Label>Snooze until</Field.Label>
            <DatePicker locale="en-US" defaultValue={day(10, 22)} />
          </Field>
        </div>
      </Row>
    </Stack>
  );
}
