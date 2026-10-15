import { Field, Select } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Select",
  group: "form",
  order: 40,
  description:
    "A styled native <select>, on purpose: the platform picker is the best one on touch and the a11y is the browser's. The placeholder reads muted until a value is chosen.",
};

const REGIONS = (
  <>
    <option value="eu-west-1">Europe (Ireland)</option>
    <option value="eu-central-1">Europe (Frankfurt)</option>
    <option value="us-east-1">US East (N. Virginia)</option>
    <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
  </>
);

export default function SelectSection() {
  return (
    <Stack>
      <Row label="Placeholder · value · option groups · long option">
        <Grid>
          <Field required>
            <Field.Label>Region</Field.Label>
            <Select placeholder="Choose a region">{REGIONS}</Select>
          </Field>
          <Field>
            <Field.Label>Refresh</Field.Label>
            <Select defaultValue="30">
              <option value="0">Off</option>
              <option value="10">Every 10 seconds</option>
              <option value="30">Every 30 seconds</option>
              <option value="60">Every minute</option>
            </Select>
          </Field>
          <Field>
            <Field.Label>Notify</Field.Label>
            <Select defaultValue="team-payments">
              <optgroup label="Teams">
                <option value="team-payments">Payments platform and checkout reliability on-call</option>
                <option value="team-search">Search</option>
              </optgroup>
              <optgroup label="People">
                <option value="ada">Ada Lovelace</option>
              </optgroup>
            </Select>
          </Field>
        </Grid>
      </Row>
      <Row label="States: invalid · disabled · read-only">
        <Grid>
          <Field>
            <Field.Label>Failover region</Field.Label>
            <Select defaultValue="eu-west-1">{REGIONS}</Select>
            <Field.Error>Must differ from the primary region.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Plan</Field.Label>
            <Select defaultValue="team">
              <option value="team">Team</option>
            </Select>
          </Field>
          <Field readOnly>
            <Field.Label>Data residency</Field.Label>
            <Select defaultValue="eu-central-1">{REGIONS}</Select>
            <Field.Description>Set at workspace creation.</Field.Description>
          </Field>
        </Grid>
      </Row>
      <Row label="Compact subtree · RTL">
        <Grid>
          <div data-density="compact">
            <Field>
              <Field.Label>Region</Field.Label>
              <Select defaultValue="us-east-1">{REGIONS}</Select>
            </Field>
          </div>
          <div dir="rtl">
            <Select aria-label="المنطقة" defaultValue="b">
              <option value="a">أوروبا</option>
              <option value="b">الشرق الأوسط</option>
            </Select>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
