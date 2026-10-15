import { useState } from "react";

import { Field, TagInput } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";
import { LABEL_SUGGESTIONS, validateLabel } from "./parts/selection-data";

export const meta = {
  title: "TagInput",
  group: "form",
  order: 130,
  description:
    "Free-form tags: Enter, comma, semicolon or a pasted list. Duplicates (ignoring case) and invalid tags are refused with a message under the field, and the text stays to fix. Optional suggestions in the combobox list.",
};

export default function TagInputSection() {
  const [labels, setLabels] = useState(["p1", "checkout"]);
  return (
    <Stack>
      <Row label="Validation · suggestions · paste “a, b; c” · many tags wrap">
        <Grid>
          <Field>
            <Field.Label>Labels</Field.Label>
            <TagInput
              value={labels}
              onValueChange={setLabels}
              validate={validateLabel}
              suggestions={LABEL_SUGGESTIONS}
              name="labels"
              placeholder="Add a label"
            />
            <Field.Description>Lower-case, digits and dashes. Try “Checkout” or “two words”.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Recipients</Field.Label>
            <TagInput
              validate={(tag) => (/^[^\s@]+@[^\s@]+$/.test(tag) ? null : `“${tag}” is not an email address.`)}
              defaultValue={[
                "ada@example.com",
                "grace.hopper@navy.example.org",
                "katherine.johnson.flight-dynamics@nasa.example.gov",
                "ops@example.com",
              ]}
            />
          </Field>
          <Field>
            <Field.Label>Hosts</Field.Label>
            <TagInput max={3} defaultValue={["web-1", "web-2"]} />
            <Field.Description>Up to three.</Field.Description>
          </Field>
        </Grid>
      </Row>
      <Row label="States: invalid · disabled · read-only">
        <Grid>
          <Field required>
            <Field.Label>Labels</Field.Label>
            <TagInput />
            <Field.Error>Add at least one label.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Labels</Field.Label>
            <TagInput defaultValue={["archived"]} />
          </Field>
          <Field readOnly>
            <Field.Label>Labels</Field.Label>
            <TagInput defaultValue={["p2", "billing"]} />
          </Field>
        </Grid>
      </Row>
      <Row label="Compact subtree · RTL">
        <Grid>
          <div data-density="compact">
            <Field>
              <Field.Label>Labels</Field.Label>
              <TagInput defaultValue={["p3", "flaky"]} suggestions={LABEL_SUGGESTIONS} />
            </Field>
          </div>
          <div dir="rtl">
            <Field>
              <Field.Label>الوسوم</Field.Label>
              <TagInput defaultValue={["عاجل", "الدفع"]} />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
