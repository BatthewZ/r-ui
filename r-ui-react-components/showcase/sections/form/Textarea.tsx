import { useState } from "react";

import { Field, Textarea } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Textarea",
  group: "form",
  order: 30,
  description:
    "The one control not at h-control: its height is its rows. `autosize` grows with the text (rows is the floor, maxRows the cap, then it scrolls).",
};

export default function TextareaSection() {
  const [note, setNote] = useState("Type a few lines: this one grows to five rows, then scrolls.");
  return (
    <Stack>
      <Row label="Fixed rows (resizable) · autosize · autosize capped at 5 rows (controlled)">
        <Grid>
          <Field>
            <Field.Label>Summary</Field.Label>
            <Textarea placeholder="What happened, in a sentence or two." />
          </Field>
          <Field>
            <Field.Label>Timeline</Field.Label>
            <Textarea autosize rows={2} defaultValue={"09:12 Alert fired\n09:14 Acknowledged"} />
            <Field.Description>Grows as you type.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Postmortem notes</Field.Label>
            <Textarea autosize rows={2} maxRows={5} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Grid>
      </Row>
      <Row label="States: invalid · disabled · read-only">
        <Grid>
          <Field required>
            <Field.Label>Root cause</Field.Label>
            <Textarea rows={2} />
            <Field.Error>Describe the root cause before closing the incident.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Customer message</Field.Label>
            <Textarea rows={2} defaultValue="We are investigating elevated error rates." />
          </Field>
          <Field readOnly>
            <Field.Label>Resolution</Field.Label>
            <Textarea rows={2} defaultValue="Rolled back deploy 4f2a1c. Error rate returned to baseline at 09:41." />
          </Field>
        </Grid>
      </Row>
    </Stack>
  );
}
