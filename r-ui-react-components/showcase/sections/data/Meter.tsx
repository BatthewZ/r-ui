import type { ReactNode } from "react";

import { Meter } from "../../../src";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "Meter",
  group: "data",
  order: 60,
  description:
    "A value in a known range with thresholds that map to status tones. The tone is the fill AND a distinct icon by the value AND spoken in aria-valuetext; worse='low' flips the thresholds for budgets and free space.",
};

const CPU = [
  { at: 80, tone: "warning" as const },
  { at: 90, tone: "error" as const },
];
const BUDGET = [
  { at: 50, tone: "warning" as const },
  { at: 25, tone: "serious" as const },
  { at: 10, tone: "error" as const },
];

export default function MeterSection() {
  return (
    <div className="grid grid-cols-1 gap-r1 @2xl:grid-cols-2">
      <Demo title="Error budget remaining (worse = low)">
        {[
          ["checkout", 8],
          ["search", 41],
          ["api-gateway", 64],
          ["notifications-delivery-pipeline-eu-west-1", 22],
          ["billing", null],
        ].map(([name, left]) => (
          <Meter
            key={name}
            label={name}
            value={left as number | null}
            worse="low"
            thresholds={BUDGET}
          />
        ))}
      </Demo>
      <Demo title="Inline (table cells), CPU (worse = high), custom value text">
        <Meter variant="inline" label="api CPU" value={62} thresholds={CPU} />
        <Meter variant="inline" label="search CPU" value={83} thresholds={CPU} />
        <Meter variant="inline" label="checkout CPU" value={97} thresholds={CPU} />
        <Meter label="Disk used, /var" value={412} max={500} valueText="412 of 500 GB" thresholds={[{ at: 400, tone: "warning" }]} />
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r3">
      <DemoLabel>{title}</DemoLabel>
      {children}
    </div>
  );
}
