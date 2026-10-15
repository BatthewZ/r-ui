import { useState } from "react";

import { Button } from "../../../src/components/primitives";
import { Stepper } from "../../../src/components/steps";
import { Row, Stack } from "../form/parts/demo";

export const meta = {
  title: "Stepper",
  group: "steps",
  order: 10,
  description:
    "Progress through ordered steps. Complete, current, upcoming, error, skipped and optional each have a marker shape, a glyph and a word, and the current step is aria-current, so none relies on colour. With onStepSelect the steps behind you are buttons in a nav. Horizontal collapses to “Step n of m · name” when its own container is narrow; vertical carries descriptions.",
};

function EveryState() {
  return (
    <Stepper current={2}>
      <Stepper.Step label="Account" />
      <Stepper.Step label="Integrations" optional status="skipped" />
      <Stepper.Step label="Billing" />
      <Stepper.Step label="Security" status="error" />
      <Stepper.Step label="Review" optional />
    </Stepper>
  );
}

const DEPLOY = [
  { label: "Build", description: "Compile and test" },
  { label: "Staging", description: "Deploy and smoke-test" },
  { label: "Approval", description: "A release manager signs off" },
  { label: "Production", description: "Roll out in three waves" },
];

function Selectable() {
  const [current, setCurrent] = useState(2);
  return (
    <div className="grid gap-r3" data-sc="stepper-selectable">
      <Stepper current={current} onStepSelect={setCurrent} label="Release progress">
        {DEPLOY.map((s) => (
          <Stepper.Step key={s.label} label={s.label} description={s.description} />
        ))}
      </Stepper>
      <div className="flex flex-wrap items-center gap-r4">
        <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Back
        </Button>
        <Button disabled={current >= DEPLOY.length} onClick={() => setCurrent((c) => c + 1)}>
          {current >= DEPLOY.length - 1 ? "Finish" : "Next"}
        </Button>
        <span className="text-body-2 text-fg-secondary">current: {current}</span>
      </div>
    </div>
  );
}

function Vertical() {
  return (
    <Stepper current={1} orientation="vertical" label="Onboarding" data-sc="stepper-vertical">
      <Stepper.Step label="Create the workspace" description="Name, URL and plan" />
      <Stepper.Step label="Invite your team" description="Everyone gets an email with a link to join." />
      <Stepper.Step
        label="Connect the incident channel"
        description="Post new incidents to Slack, Microsoft Teams or a webhook of your own."
        optional
      />
      <Stepper.Step label="Turn on paging" description="Routes urgent alerts to whoever is on call." />
    </Stepper>
  );
}

const LONG = [
  "Verify the organisation's billing contact",
  "Connect the identity provider (SAML or OIDC) and map its groups",
  "Supercalifragilisticexpialidociousconfiguration",
];

export default function StepperSection() {
  return (
    <Stack>
      <Row label="Every state · complete, skipped (optional), current, error, upcoming (optional)">
        <div data-sc="stepper-states">
          <EveryState />
        </div>
      </Row>
      <Row label="Selectable · the steps behind you are buttons; upcoming ones are not">
        <Selectable />
      </Row>
      <Row label="Vertical with descriptions">
        <div className="max-w-measure">
          <Vertical />
        </div>
      </Row>
      <Row label="Long labels wrap; an unbroken word breaks">
        <Stepper current={1}>
          {LONG.map((label) => (
            <Stepper.Step key={label} label={label} />
          ))}
        </Stepper>
      </Row>
      <Row label="Narrow container · collapses to “Step n of m · name”">
        <div className="max-w-column-lg" data-sc="stepper-narrow">
          <EveryState />
        </div>
      </Row>
      <Row label="Compact density">
        <div data-density="compact" data-sc="stepper-compact">
          <EveryState />
        </div>
      </Row>
      <Row label="RTL">
        <div dir="rtl" data-sc="stepper-rtl">
          <Stepper current={1} onStepSelect={() => {}} label="التقدم">
            <Stepper.Step label="الحساب" />
            <Stepper.Step label="الفريق" />
            <Stepper.Step label="المراجعة" status="error" />
          </Stepper>
        </div>
      </Row>
    </Stack>
  );
}
