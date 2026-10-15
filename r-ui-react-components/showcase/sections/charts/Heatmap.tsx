import { Heatmap } from "../../../src";
import { HEAT, HOURS, WEEKDAYS } from "./fixtures";

export const meta = {
  title: "Heatmap",
  group: "charts",
  order: 30,
  description:
    "Weekday × hour on the sequential ramp, cells --HEAT-CELL tall, hour labels thinned from midnight to the width. Arrows move cell by cell and announce the value; hover and tap show it. A missing value is an empty dashed cell, never a zero.",
};

const withGaps = HEAT.map((row, d) => row.map((v, h) => (d === 6 && h < 6 ? null : v)));

export default function HeatmapSection() {
  return (
    <div className="grid grid-cols-1 gap-r2 @3xl:grid-cols-2">
      <Heatmap label="5xx errors by weekday and hour, last 7 days" rows={WEEKDAYS} columns={HOURS} values={HEAT} valueLabel="5xx errors" />
      <div data-density="compact">
        <Heatmap
          label="5xx errors by weekday and hour, compact, with missing hours"
          rows={WEEKDAYS}
          columns={HOURS}
          values={withGaps}
          valueLabel="5xx errors"
        />
      </div>
    </div>
  );
}
