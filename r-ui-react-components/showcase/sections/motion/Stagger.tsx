import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { Badge, Button } from "../../../src/components/primitives";
import { Stagger } from "../../../src/components/motion";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Stagger",
  group: "motion",
  order: 20,
  description:
    "Children enter one after another (--MOTION-STAGGER apart, capped so a long list never waits). The children stay the container's own, so a list keeps ul > li. Plays on scroll (default) or on mount.",
};

const RESULTS = [
  { name: "checkout-api", status: "Degraded" },
  { name: "payments-worker", status: "Healthy" },
  { name: "search-indexer", status: "Healthy" },
  { name: "notifications", status: "Healthy" },
  { name: "image-resizer", status: "Paused" },
];

export default function StaggerSection() {
  const [run, setRun] = useState(0);
  return (
    <Stack>
      <Row label='trigger="mount": results arriving (replay remounts the list)'>
        <div className="flex max-w-measure flex-col gap-r4">
          <div>
            <Button variant="secondary" iconStart={<RotateCcw />} onClick={() => setRun((n) => n + 1)}>
              Replay
            </Button>
          </div>
          <Stagger key={run} as="ul" trigger="mount" className="flex flex-col divide-y divide-border border-y border-border" data-sc="stagger-list">
            {RESULTS.map(({ name, status }) => (
              <li key={name} className="flex min-h-row items-center justify-between gap-r4 px-r4 text-body-1">
                <span className="min-w-0 truncate font-mono">{name}</span>
                <Badge variant="outline">{status}</Badge>
              </li>
            ))}
          </Stagger>
        </div>
      </Row>
      <Row label='trigger="scroll" (default): a grid that plays when it first comes into view'>
        <Stagger className="grid gap-r4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))]">
          {["Latency", "Errors", "Saturation", "Traffic"].map((label) => (
            <div key={label} className="rounded-lg border border-border bg-surface-0 p-r3 text-body-1">
              {label}
            </div>
          ))}
        </Stagger>
      </Row>
    </Stack>
  );
}
