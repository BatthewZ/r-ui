import { useState } from "react";

import { Field, Input, Radio, RadioGroup, Select, Switch, Textarea } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Field",
  group: "form",
  order: 10,
  description:
    "Label, description and error wired to the control by context. Horizontal fields put the label beside the control once the FIELD is wide enough: the two boxes below are the same markup at two container widths.",
};

function HorizontalForm() {
  return (
    <div className="grid gap-r3">
      <Field orientation="horizontal" required>
        <Field.Label>Service name</Field.Label>
        <Input defaultValue="checkout-api" />
        <Field.Description>Lowercase, used in alert titles.</Field.Description>
      </Field>
      <Field orientation="horizontal">
        <Field.Label>Escalation policy for out-of-hours pages</Field.Label>
        <Select defaultValue="primary">
          <option value="primary">Primary on-call, then secondary</option>
          <option value="team">Whole team</option>
        </Select>
      </Field>
      <Field orientation="horizontal">
        <Field.Label>Runbook</Field.Label>
        <Textarea rows={2} defaultValue="Restart the worker pool, then check queue depth." />
      </Field>
      <Field orientation="horizontal">
        <Field.Label>Paging</Field.Label>
        <Switch defaultChecked>Page on-call for P1 incidents</Switch>
      </Field>
      <Field orientation="horizontal">
        <Field.Label>Severity</Field.Label>
        <RadioGroup defaultValue="p2">
          <Radio value="p1">P1: customer-facing</Radio>
          <Radio value="p2">P2: degraded</Radio>
        </RadioGroup>
      </Field>
    </div>
  );
}

export default function FieldSection() {
  const [email, setEmail] = useState("ops@");
  const error = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? undefined : "Enter an address like name@example.com";

  return (
    <Stack>
      <Row label="Vertical · description · live error (fix the address to clear it)">
        <Grid>
          <Field required>
            <Field.Label>Alert email</Field.Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field.Description>Incident summaries go here.</Field.Description>
            <Field.Error>{error}</Field.Error>
          </Field>
          <Field>
            <Field.Label>Display name</Field.Label>
            <Input placeholder="e.g. Payments on-call" />
            <Field.Description>Optional. Shown in the sidebar.</Field.Description>
          </Field>
        </Grid>
      </Row>

      <Row label="States: disabled · read-only · invalid without a message">
        <Grid>
          <Field disabled>
            <Field.Label>Region</Field.Label>
            <Input defaultValue="eu-west-1" />
            <Field.Description>Locked while a deploy runs.</Field.Description>
          </Field>
          <Field readOnly>
            <Field.Label>Workspace ID</Field.Label>
            <Input defaultValue="ws_8f2c1a9e4b" />
          </Field>
          <Field invalid>
            <Field.Label>Webhook URL</Field.Label>
            <Input defaultValue="htp://hooks.example" />
          </Field>
        </Grid>
      </Row>

      <Row label="Horizontal · narrow container (stacks) vs wide container (label beside)">
        <div className="grid gap-r3 @container">
          <div className="rounded-md border border-dashed p-r3 @2xl:w-1/3">
            <HorizontalForm />
          </div>
          <div className="rounded-md border border-dashed p-r3">
            <HorizontalForm />
          </div>
        </div>
      </Row>

      <Row label="Long label and long error wrap; RTL">
        <Grid>
          <Field>
            <Field.Label>Maximum number of concurrent background export jobs per workspace</Field.Label>
            <Input defaultValue="12" />
            <Field.Error>
              This exceeds your plan&apos;s limit of 8 concurrent jobs. Lower it, or upgrade the workspace plan.
            </Field.Error>
          </Field>
          <div dir="rtl">
            <Field required>
              <Field.Label>اسم الخدمة</Field.Label>
              <Input defaultValue="checkout-api" />
              <Field.Description>يُستخدم في عناوين التنبيهات.</Field.Description>
              <Field.Error>الاسم مستخدم بالفعل</Field.Error>
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
