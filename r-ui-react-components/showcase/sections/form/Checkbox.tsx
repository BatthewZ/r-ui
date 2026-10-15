import { useState } from "react";

import { Checkbox, Field } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Checkbox",
  group: "form",
  order: 60,
  description:
    "A small box, a --HIT-MIN hit area from a pseudo-element, and a clickable label. Indeterminate is the 'some of these' state of a select-all.",
};

const CHANNELS = ["Email", "Slack", "SMS"] as const;

function SelectAll() {
  const [on, setOn] = useState<Set<string>>(new Set(["Email"]));
  const all = on.size === CHANNELS.length;
  const some = on.size > 0 && !all;
  return (
    <fieldset className="grid gap-r4">
      <legend className="mb-r4 text-body-1 font-medium">Notify me by</legend>
      <Checkbox
        checked={all}
        indeterminate={some}
        onCheckedChange={(next) => setOn(new Set(next ? CHANNELS : []))}
      >
        All channels
      </Checkbox>
      <div className="grid gap-r4 ps-r1">
        {CHANNELS.map((c) => (
          <Checkbox
            key={c}
            checked={on.has(c)}
            onCheckedChange={(next) =>
              setOn((prev) => {
                const copy = new Set(prev);
                if (next) copy.add(c);
                else copy.delete(c);
                return copy;
              })
            }
          >
            {c}
          </Checkbox>
        ))}
      </div>
    </fieldset>
  );
}

export default function CheckboxSection() {
  return (
    <Stack>
      <Row label="Unchecked · checked · indeterminate · no visible label (aria-label)">
        <div className="flex flex-wrap items-start gap-r2">
          <Checkbox>Unchecked</Checkbox>
          <Checkbox defaultChecked>Checked</Checkbox>
          <Checkbox indeterminate>Indeterminate</Checkbox>
          <Checkbox aria-label="Select row 3" />
        </div>
      </Row>
      <Row label="Select all (controlled, indeterminate while some are on)">
        <SelectAll />
      </Row>
      <Row label="States: disabled · disabled checked · read-only · invalid with message">
        <Grid>
          <div className="grid gap-r4">
            <Checkbox disabled>Disabled</Checkbox>
            <Checkbox disabled defaultChecked>
              Disabled, checked
            </Checkbox>
            <Checkbox readOnly defaultChecked>
              Read-only, checked
            </Checkbox>
          </div>
          <Field>
            <Checkbox>I have read the data processing agreement</Checkbox>
            <Field.Error>Accept the agreement to continue.</Field.Error>
          </Field>
        </Grid>
      </Row>
      <Row label="Long label wraps under itself, the box stays on the first line · compact · RTL">
        <Grid>
          <Checkbox defaultChecked>
            Also page the secondary on-call if the primary has not acknowledged within fifteen minutes, including
            outside business hours
          </Checkbox>
          <div data-density="compact" className="grid gap-r4">
            <Checkbox defaultChecked>Compact</Checkbox>
            <Checkbox indeterminate>Compact, mixed</Checkbox>
          </div>
          <div dir="rtl" className="grid gap-r4">
            <Checkbox defaultChecked>تفعيل التنبيهات</Checkbox>
            <Checkbox>إرسال ملخص يومي</Checkbox>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
