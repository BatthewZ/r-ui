import { useState } from "react";

import { Field, NumberInput } from "../../../src/components/form";
import { formatNumber } from "../../../src/util/format";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "NumberInput",
  group: "form",
  order: 100,
  description:
    "A spinbutton: ArrowUp/Down step, PageUp/PageDown step ten, Home/End jump to the bounds. Locale-formatted with tabular figures; typed text is read in the same locale and committed on blur or Enter.",
};

export default function NumberInputSection() {
  const [replicas, setReplicas] = useState<number | null>(3);
  return (
    <Stack>
      <Row label="Bounded integer (controlled) · decimal step · unit · large and negative values">
        <Grid>
          <Field>
            <Field.Label>Replicas</Field.Label>
            <NumberInput value={replicas} onValueChange={setReplicas} min={1} max={12} />
            <Field.Description>
              1–12. Committed: {replicas === null ? "empty" : formatNumber(replicas)}
            </Field.Description>
          </Field>
          <Field>
            <Field.Label>Error budget</Field.Label>
            <NumberInput defaultValue={0.5} step={0.1} min={0} max={5} precision={1} end="%" />
          </Field>
          <Field>
            <Field.Label>p95 latency target</Field.Label>
            <NumberInput defaultValue={250} step={10} min={0} end="ms" />
          </Field>
          <Field>
            <Field.Label>Monthly requests cap</Field.Label>
            <NumberInput defaultValue={12_500_000} step={100_000} />
          </Field>
          <Field>
            <Field.Label>Timezone offset (minutes)</Field.Label>
            <NumberInput defaultValue={-330} step={15} min={-720} max={840} />
          </Field>
          <Field>
            <Field.Label>Empty, seeds at its minimum</Field.Label>
            <NumberInput min={10} placeholder="10 or more" />
          </Field>
        </Grid>
      </Row>
      <Row label="Locales: de-DE (1.234,5) · fr-FR (narrow no-break space) · ar-EG (Arabic-Indic digits)">
        <Grid>
          <NumberInput aria-label="German" locale="de-DE" defaultValue={1234.5} step={0.5} />
          <NumberInput aria-label="French" locale="fr-FR" defaultValue={98765.25} />
          <div dir="rtl">
            <NumberInput aria-label="Arabic" locale="ar-EG" defaultValue={1500} labels={{ increment: "زيادة", decrement: "إنقاص" }} />
          </div>
        </Grid>
      </Row>
      <Row label="States: invalid · disabled · read-only · at its maximum (+ disabled) · compact">
        <Grid>
          <Field>
            <Field.Label>Seats</Field.Label>
            <NumberInput defaultValue={0} min={0} />
            <Field.Error>At least one seat is required.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Retention days</Field.Label>
            <NumberInput defaultValue={30} />
          </Field>
          <Field readOnly>
            <Field.Label>Current usage</Field.Label>
            <NumberInput defaultValue={8421} />
          </Field>
          <Field>
            <Field.Label>Concurrency</Field.Label>
            <NumberInput defaultValue={8} min={1} max={8} />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Compact</Field.Label>
              <NumberInput defaultValue={42} end="ms" />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
