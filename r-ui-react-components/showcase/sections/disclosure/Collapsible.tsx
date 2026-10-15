import { useState } from "react";

import { Field, Input, Switch } from "../../../src/components/form";
import { Collapsible } from "../../../src/components/disclosure";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Collapsible",
  group: "disclosure",
  order: 20,
  description:
    "One button that shows and hides one region (the disclosure pattern). The trigger is a Button with aria-expanded and a turning chevron; closed content is inert. Height animates; reduced motion makes it instant.",
};

/** Inset by the ghost trigger's own padding, so the content lines up with its label. */
function AdvancedFields() {
  return (
    <div className="flex flex-col gap-r3 ps-r3 pt-r4">
      <Field>
        <Field.Label>Retries</Field.Label>
        <Input defaultValue="3" />
      </Field>
      <Field>
        <Field.Label>Timeout (seconds)</Field.Label>
        <Input defaultValue="30" />
      </Field>
    </div>
  );
}

function Controlled() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-r4">
      <Switch checked={open} onCheckedChange={setOpen}>
        Show advanced settings
      </Switch>
      <Collapsible open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger variant="secondary">Advanced settings</Collapsible.Trigger>
        <Collapsible.Content>
          <AdvancedFields />
        </Collapsible.Content>
      </Collapsible>
    </div>
  );
}

export default function CollapsibleSection() {
  return (
    <Stack>
      <Row label="Ghost trigger (default) · form content">
        <div className="max-w-measure" data-sc="collapsible-basic">
          <Collapsible>
            <Collapsible.Trigger>Advanced settings</Collapsible.Trigger>
            <Collapsible.Content>
              <AdvancedFields />
            </Collapsible.Content>
          </Collapsible>
        </div>
      </Row>
      <Row label="Open by default · long text">
        <div className="max-w-measure">
          <Collapsible defaultOpen>
            <Collapsible.Trigger>Why was this alert suppressed?</Collapsible.Trigger>
            <Collapsible.Content>
              <p className="ps-r3 pt-r4 text-body-1 text-fg-secondary">
                A maintenance window covers this service until 14:00 UTC. Alerts raised during the window are recorded
                on the timeline but page nobody; a summary of everything suppressed is posted when the window ends.
              </p>
            </Collapsible.Content>
          </Collapsible>
        </div>
      </Row>
      <Row label="Controlled by a switch · secondary trigger">
        <div className="max-w-measure">
          <Controlled />
        </div>
      </Row>
      <Row label="Disabled · compact density">
        <div className="flex flex-wrap items-start gap-r2" data-density="compact">
          <Collapsible disabled>
            <Collapsible.Trigger>Locked by policy</Collapsible.Trigger>
            <Collapsible.Content>Never shown.</Collapsible.Content>
          </Collapsible>
          <Collapsible>
            <Collapsible.Trigger>Compact</Collapsible.Trigger>
            <Collapsible.Content>
              <AdvancedFields />
            </Collapsible.Content>
          </Collapsible>
        </div>
      </Row>
    </Stack>
  );
}
