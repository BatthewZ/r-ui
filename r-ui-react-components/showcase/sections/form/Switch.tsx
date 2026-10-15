import { useState } from "react";

import { Field, Switch } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Switch",
  group: "form",
  order: 80,
  description:
    "An on/off setting that applies at once: a native checkbox with role=switch, so it submits like one. Small track, --HIT-MIN hit area, clickable label.",
};

export default function SwitchSection() {
  const [live, setLive] = useState(true);
  return (
    <Stack>
      <Row label="Off · on · controlled with live readout · no visible label">
        <div className="flex flex-wrap items-start gap-r2">
          <Switch>Off</Switch>
          <Switch defaultChecked>On</Switch>
          <Switch checked={live} onCheckedChange={setLive}>
            Live updates: {live ? "on" : "paused"}
          </Switch>
          <Switch aria-label="Dark mode" />
        </div>
      </Row>
      <Row label="Settings list with descriptions">
        <div className="grid max-w-measure gap-r3">
          <Field>
            <Switch defaultChecked>Page on-call for P1 incidents</Switch>
            <Field.Description>Calls and texts the primary until acknowledged.</Field.Description>
          </Field>
          <Field>
            <Switch>Weekly digest</Switch>
            <Field.Description>A Monday summary of last week&apos;s incidents.</Field.Description>
          </Field>
        </div>
      </Row>
      <Row label="States: disabled off/on · read-only · invalid">
        <div className="flex flex-wrap items-start gap-r2">
          <Switch disabled>Disabled</Switch>
          <Switch disabled defaultChecked>
            Disabled, on
          </Switch>
          <Switch readOnly defaultChecked>
            Read-only, on
          </Switch>
        </div>
        <Field>
          <Switch>Require two-factor authentication</Switch>
          <Field.Error>Required by your organisation.</Field.Error>
        </Field>
      </Row>
      <Row label="Long label · compact · RTL (thumb travels to the inline end)">
        <Grid>
          <Switch defaultChecked>
            Automatically resolve incidents when every alert in them has been healthy for thirty minutes
          </Switch>
          <div data-density="compact" className="grid gap-r4">
            <Switch defaultChecked>Compact on</Switch>
            <Switch>Compact off</Switch>
          </div>
          <div dir="rtl" className="grid gap-r4">
            <Switch defaultChecked>تحديثات مباشرة</Switch>
            <Switch>الوضع الداكن</Switch>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
