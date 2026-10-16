import { useState } from "react";

import { Button, Card } from "../../../src/components/primitives";
import { Checkbox } from "../../../src/components/form";
import { ProgressRing } from "../../../src/components/feedback";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "ProgressRing",
  group: "feedback",
  order: 20,
  description:
    "Progress as a ring where a bar does not fit. Sized by tokens (icon, control, large), a centre slot for a value or a count, the same spoken reading as ProgressBar. Indeterminate turns, as a Spinner does, under reduced motion too. Under forced colours the arc keeps its system colour over a GrayText track.",
};

const TASKS = ["Create the workspace", "Invite your team", "Connect a data source", "Build a first dashboard", "Set up alerts"];

/** Ticking the checklist moves the ring. */
function Onboarding() {
  const [done, setDone] = useState<boolean[]>([true, true, true, false, false]);
  const count = done.filter(Boolean).length;
  return (
    <Card data-sc="ring-onboarding">
      <Card.Body className="flex flex-wrap items-center gap-r2 py-r2">
        <ProgressRing
          size="large"
          label="Getting started"
          value={count}
          max={TASKS.length}
          valueText={`${count} of ${TASKS.length} steps done`}
          tone={count === TASKS.length ? "success" : "accent"}
        >
          {count}/{TASKS.length}
        </ProgressRing>
        <div className="grid min-w-0 flex-1 basis-column-sm gap-r5">
          <p className="text-h5">Getting started</p>
          {TASKS.map((task, i) => (
            <Checkbox
              key={task}
              checked={done[i]}
              onCheckedChange={(checked) => setDone((d) => d.map((v, j) => (j === i ? checked : v)))}
            >
              {task}
            </Checkbox>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

export default function ProgressRingSection() {
  return (
    <Stack>
      <Row label="Onboarding: a large ring with a count in its centre, driven by a checklist">
        <Onboarding />
      </Row>

      <Row label="Sizes: icon (in text, in a button) · control (beside a button) · large with its percentage">
        <div className="flex flex-wrap items-center gap-r3">
          <span className="inline-flex items-center gap-r5 text-body-2 text-fg-secondary">
            <ProgressRing size="icon" label="Sync" value={70} /> Syncing 70%
          </span>
          <Button variant="secondary" iconStart={<ProgressRing size="icon" label="Export" />}>
            Exporting…
          </Button>
          <span className="inline-flex items-center gap-r4">
            <ProgressRing label="Disk scan" value={25} showValue />
            <Button variant="ghost">Cancel scan</Button>
          </span>
          <ProgressRing size="large" label="Course progress" value={42} showValue />
        </div>
      </Row>

      <Row label="States: empty · done · tones · indeterminate at each size">
        <div className="flex flex-wrap items-center gap-r3">
          <ProgressRing size="large" label="Not started" value={0} showValue />
          <ProgressRing size="large" label="Done" value={100} tone="success" showValue />
          <ProgressRing size="large" label="Retrying" value={64} tone="warning" showValue />
          <ProgressRing size="large" label="Failed" value={38} tone="error" showValue />
          <ProgressRing size="large" label="Neutral" value={50} tone="neutral" showValue />
          <ProgressRing size="icon" label="Loading" />
          <ProgressRing label="Loading" />
          <ProgressRing size="large" label="Loading" data-sc="ring-indeterminate" />
        </div>
      </Row>

      <Row label="Compact (re-derives inside) · RTL">
        <div className="flex flex-wrap items-center gap-r3">
          <div data-density="compact" className="flex items-center gap-r4">
            <ProgressRing size="icon" label="Compact icon" value={60} />
            <ProgressRing label="Compact control" value={60} showValue />
            <ProgressRing size="large" label="Compact large" value={60} showValue />
          </div>
          <div dir="rtl" className="flex items-center gap-r4">
            <ProgressRing size="large" label="التقدم" value={3} max={4} showValue locale="ar-EG" />
            <span className="text-body-2">ثلاث خطوات من أربع</span>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
