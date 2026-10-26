import type { ReactNode } from "react";

import { LineChart } from "../../../src";
import { times, wave } from "./fixtures";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "LineChart",
  group: "charts",
  order: 10,
  description:
    "Time, number and category axes with nice value ticks and labels thinned to the width. Hover snaps a crosshair to the nearest x with one tooltip for every series; the plot is focusable (arrows, Home, End) and announces politely; a tap inspects on touch. The table is always there for a screen reader, and on Show as table.",
};

const week = times(42, 4);
const regions = [
  { name: "us-east", values: wave(42, 1850, 0, 4) },
  { name: "eu-west", values: wave(42, 1320, 2.2, 4) },
  { name: "ap-south", values: wave(42, 880, 4.4, 4) },
  { name: "sa-east", values: wave(42, 410, 6.6, 4) },
];
const day = times(24, 1);
const latency = [{ name: "p95 latency", values: wave(24, 180, 1).map((v, i) => (i === 9 || i === 10 ? null : v)) }];
const signed = [
  { name: "Net change", values: [12, -4, 30, -18, 6, 22, -9, 15, -2, 8, 0, 19] },
  { name: "Forecast", values: [10, 2, 18, -6, 9, 14, -3, 11, 4, 6, 3, 12] },
];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function LineChartSection() {
  return (
    <div className="grid grid-cols-1 gap-r2 @3xl:grid-cols-2">
      <Demo title="Time axis, four series (a week at 4-hour steps)">
        <LineChart label="Requests per second by region, last 7 days" x={week} series={regions} unit="req/s" timeZone="UTC" />
      </Demo>
      <Demo title="One series as an area, with a gap (no data for two hours)">
        <LineChart label="p95 latency, last 24 hours" x={day} series={latency} unit="millisecond" area timeZone="UTC" />
      </Demo>
      <Demo title="Categories, negatives through a zero line">
        <LineChart label="Net change by month" x={months} series={signed} />
      </Demo>
      <Demo title="Number axis, pinned value range">
        <LineChart
          label="Error rate by concurrency"
          x={[1, 2, 4, 8, 16, 32, 64]}
          series={[{ name: "Error rate", values: [0.1, 0.1, 0.2, 0.4, 1.1, 3.8, 9.6] }]}
          unit="percent"
          min={0}
          max={10}
        />
      </Demo>
      <div className="@3xl:col-span-2" data-density="compact">
        <Demo title="Compact density (a shorter --CHART-H)">
          <LineChart label="Requests per second by region, compact" x={week} series={regions} unit="req/s" timeZone="UTC" />
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
