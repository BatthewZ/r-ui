import type { ReactNode } from "react";

import { BarChart } from "../../../src";
import { times, wave } from "./fixtures";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "BarChart",
  group: "charts",
  order: 20,
  description:
    "Columns or bars from one zero baseline, grouped or stacked, --BAR-THICK thick, the data end curved and the base square. A time band axis labels calendar boundaries only. The band under the cursor lists every series (and the total when stacked); horizontal bars carry the value at the tip.",
};

const classes = ["5xx server", "4xx client", "Timeouts", "Rate limited"];
const week = times(42, 4);
const errors = [
  { name: "5xx server", values: wave(42, 140, 1, 4) },
  { name: "4xx client", values: wave(42, 480, 3, 4) },
  { name: "Timeouts", values: wave(42, 44, 5, 4) },
];
const quarters = ["Q1", "Q2", "Q3", "Q4"];

export default function BarChartSection() {
  return (
    <div className="grid grid-cols-1 gap-r2 @3xl:grid-cols-2">
      <Demo title="Horizontal, one series, value at the tip">
        <BarChart
          label="Errors by class, last 7 days"
          orientation="horizontal"
          x={classes}
          series={[{ name: "Errors", values: [5820, 20160, 1840, 96] }]}
        />
      </Demo>
      <Demo title="Grouped columns, negatives below zero">
        <BarChart
          label="Budget vs actual by quarter"
          x={quarters}
          series={[
            { name: "Budget", values: [120, 140, 135, 160] },
            { name: "Actual", values: [110, 152, -12, 171] },
          ]}
          unit="USD"
        />
      </Demo>
      <div className="@3xl:col-span-2">
        <Demo title="Stacked over a time band axis (labels on day boundaries)">
          <BarChart label="Error responses by class, last 7 days" stacked x={week} series={errors} timeZone="UTC" />
        </Demo>
      </div>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <DemoLabel>{title}</DemoLabel>
      {children}
    </div>
  );
}
