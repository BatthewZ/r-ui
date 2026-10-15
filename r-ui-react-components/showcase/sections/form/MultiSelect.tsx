import { useState } from "react";

import { Field, MultiSelect } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";
import { REGIONS, SERVICES } from "./parts/selection-data";

export const meta = {
  title: "MultiSelect",
  group: "form",
  order: 120,
  description:
    "Several choices as removable chips inside the field, which wraps a control height at a time. The list stays open while choosing; Backspace removes the last chip; chips are in the tab order. Select all, a maximum, and an “n selected” summary once the field is narrower than one --COLUMN-MD.",
};

export default function MultiSelectSection() {
  const [regions, setRegions] = useState(["eu-west-1", "us-east-1"]);
  return (
    <Stack>
      <Row label="Groups · select all · controlled · many chips wrap">
        <Grid>
          <Field required>
            <Field.Label>Regions</Field.Label>
            <MultiSelect options={REGIONS} value={regions} onValueChange={setRegions} selectAll name="regions" placeholder="Any region" />
            <Field.Description>Value: {regions.join(", ") || "—"}</Field.Description>
          </Field>
          <Field>
            <Field.Label>Services</Field.Label>
            <MultiSelect
              options={SERVICES}
              defaultValue={["checkout-api", "payments-worker", "ledger-db", "search-api", "edge-zurich", "notifications"]}
            />
          </Field>
          <Field>
            <Field.Label>On-call reviewers</Field.Label>
            <MultiSelect
              max={2}
              options={["Ada Lovelace", "Grace Hopper", "Katherine Johnson", "Margaret Hamilton"].map((n) => ({ value: n, label: n }))}
              defaultValue={["Grace Hopper"]}
            />
            <Field.Description>Up to two.</Field.Description>
          </Field>
        </Grid>
      </Row>
      <Row label="Narrow field: two or more chips fold into a summary">
        <div className="flex flex-wrap gap-r3">
          <div className="w-column-sm">
            <Field>
              <Field.Label>Regions</Field.Label>
              <MultiSelect options={REGIONS} defaultValue={["eu-west-1", "eu-central-1", "us-west-2"]} />
            </Field>
          </div>
          <div className="w-column-sm">
            <Field>
              <Field.Label>Region</Field.Label>
              <MultiSelect options={REGIONS} defaultValue={["ap-southeast-2"]} />
              <Field.Description>One chip still shows itself.</Field.Description>
            </Field>
          </div>
        </div>
      </Row>
      <Row label="States: invalid · disabled · read-only">
        <Grid>
          <Field>
            <Field.Label>Regions</Field.Label>
            <MultiSelect options={REGIONS} />
            <Field.Error>Choose at least one region.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Regions</Field.Label>
            <MultiSelect options={REGIONS} defaultValue={["eu-north-1"]} />
          </Field>
          <Field readOnly>
            <Field.Label>Regions</Field.Label>
            <MultiSelect options={REGIONS} defaultValue={["eu-west-1", "eu-central-1"]} />
          </Field>
        </Grid>
      </Row>
      <Row label="Compact subtree · RTL">
        <Grid>
          <div data-density="compact">
            <Field>
              <Field.Label>Regions</Field.Label>
              <MultiSelect options={REGIONS} defaultValue={["eu-west-1", "us-east-1", "us-west-2"]} />
            </Field>
          </div>
          <div dir="rtl">
            <Field>
              <Field.Label>المناطق</Field.Label>
              <MultiSelect
                options={[
                  { value: "a", label: "أوروبا (أيرلندا)" },
                  { value: "b", label: "أوروبا (فرانكفورت)" },
                  { value: "c", label: "شرق الولايات المتحدة" },
                ]}
                defaultValue={["a", "c"]}
              />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
