import type { ReactNode } from "react";

import { BarChart, Heatmap, LineChart } from "../../../src";

export const meta = {
  title: "Hostile data",
  group: "charts",
  order: 90,
  description:
    "What an API can hand a chart, none of which may throw: no series, one point, a zero span, NaN / Infinity / 1e308, mismatched lengths, duplicate and __proto__ names, a 20,000-character label, eleven series against eight inks (capped with a note, the table lists all), and nothing drawable (the table takes the plot's place).",
};

const long = "x".repeat(20_000);
const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `service-${i + 1}`, values: [i + 2, i * 2 + 1, 12 - i, i + 5] }));

export default function HostileDataSection() {
  return (
    <div data-chart-hostile="" className="grid grid-cols-1 gap-r2 @3xl:grid-cols-2">
      <Demo title="No series">
        <LineChart label="No series" series={[]} />
      </Demo>
      <Demo title="Every value missing">
        <LineChart label="Every value missing" x={["a", "b", "c"]} series={[{ name: "gaps", values: [null, Number.NaN, null] }]} />
      </Demo>
      <Demo title="One point, zero span">
        <LineChart label="One point" series={[{ name: "only", values: [42] }]} />
      </Demo>
      <Demo title="NaN, Infinity, 1e308 and negatives">
        <LineChart
          label="Extreme values"
          series={[
            { name: "huge", values: [1e308, Number.NaN, -1e308, Infinity, 0, 3] },
            { name: "small", values: [-1, -2, -3, -4, -5, -6] },
          ]}
        />
      </Demo>
      <Demo title="Mismatched lengths, duplicate and __proto__ names, a 20,000-character label">
        <BarChart
          label="Mismatched series"
          x={["first", long, "third"]}
          series={[
            { name: "__proto__", values: [3, 1] },
            { name: "__proto__", values: [1, 2, 3, 4, 5] },
            { name: long, values: [2, 2, 2] },
          ]}
        />
      </Demo>
      <Demo title="Eleven series, eight inks">
        <LineChart label="Eleven series" x={["Mon", "Tue", "Wed", "Thu"]} series={eleven} />
      </Demo>
      <Demo title="A heatmap of nothing but gaps and infinities">
        <Heatmap label="Hostile heatmap" rows={[long, "b"]} columns={["1", "2", "3"]} values={[[Number.NaN, Infinity], [null]]} />
      </Demo>
      <Demo title="A ragged heatmap">
        <Heatmap label="Ragged heatmap" rows={["a"]} columns={[]} values={[[1, 1e308], [], [-5, 0, 7, 9]]} />
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <p className="text-body-3 font-medium text-fg-muted">{title}</p>
      {children}
    </div>
  );
}
