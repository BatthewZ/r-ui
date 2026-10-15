import { Field, Radio, RadioGroup } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "RadioGroup",
  group: "form",
  order: 70,
  description:
    "Native radios sharing a name: Tab enters at the checked radio, arrows move and select. Invalid sits on the group (ARIA allows it there, not on a radio).",
};

export default function RadioGroupSection() {
  return (
    <Stack>
      <Row label="Vertical in a Field · horizontal">
        <Grid>
          <Field required>
            <Field.Label>Severity</Field.Label>
            <RadioGroup defaultValue="p2" name="severity">
              <Radio value="p1">P1: customer-facing outage</Radio>
              <Radio value="p2">P2: degraded service</Radio>
              <Radio value="p3">P3: internal only</Radio>
            </RadioGroup>
          </Field>
          <Field>
            <Field.Label>Chart type</Field.Label>
            <RadioGroup defaultValue="line" orientation="horizontal">
              <Radio value="line">Line</Radio>
              <Radio value="bar">Bar</Radio>
              <Radio value="area">Area</Radio>
            </RadioGroup>
          </Field>
        </Grid>
      </Row>
      <Row label="States: invalid with message · disabled group · one disabled option · read-only">
        <Grid>
          <Field>
            <Field.Label>Billing cycle</Field.Label>
            <RadioGroup>
              <Radio value="m">Monthly</Radio>
              <Radio value="y">Yearly</Radio>
            </RadioGroup>
            <Field.Error>Choose a billing cycle.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Plan</Field.Label>
            <RadioGroup defaultValue="team">
              <Radio value="free">Free</Radio>
              <Radio value="team">Team</Radio>
            </RadioGroup>
          </Field>
          <Field>
            <Field.Label>Retention</Field.Label>
            <RadioGroup defaultValue="30">
              <Radio value="30">30 days</Radio>
              <Radio value="90">90 days</Radio>
              <Radio value="365" disabled>
                1 year (Enterprise)
              </Radio>
            </RadioGroup>
          </Field>
          <Field readOnly>
            <Field.Label>Data region</Field.Label>
            <RadioGroup defaultValue="eu">
              <Radio value="eu">EU</Radio>
              <Radio value="us">US</Radio>
            </RadioGroup>
          </Field>
        </Grid>
      </Row>
      <Row label="Compact · RTL">
        <Grid>
          <div data-density="compact">
            <RadioGroup aria-label="Compact" defaultValue="a">
              <Radio value="a">Compact one</Radio>
              <Radio value="b">Compact two</Radio>
            </RadioGroup>
          </div>
          <div dir="rtl">
            <RadioGroup aria-label="الخطورة" defaultValue="a">
              <Radio value="a">عالية</Radio>
              <Radio value="b">منخفضة</Radio>
            </RadioGroup>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
